import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nightsBetween, todayYmd, toYmd } from '../booking/booking.rules';
import {
  InvoiceStatsQueryDto,
  type InvoiceTab,
  QueryInvoiceDto,
} from './dto/query-invoice.dto';
import {
  InvoiceDetailDto,
  InvoiceListItemDto,
  InvoiceStatsDto,
  PaginatedInvoiceResponseDto,
} from './dto/invoice-response.dto';
import { fullName, loadInvoiceDetail, type Viewer } from './invoice-detail';
import {
  activePaid,
  dailySeries,
  invoiceCode,
  isDebt,
  MAX_STATS_DAYS,
  monthToDate,
  previousRange,
  remainingOf,
  searchTokenToBookingCode,
  vnDayRange,
} from './invoice.rules';

const LIST_SELECT = {
  id: true,
  status: true,
  total_amount: true,
  discount: true,
  final_amount: true,
  created_at: true,
  booking: {
    select: {
      id: true,
      code: true,
      status: true,
      check_in_date: true,
      check_out_date: true,
      customer: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          account_id: true,
        },
      },
      booking_rooms: { select: { room: { select: { room_number: true } } } },
    },
  },
  payments: {
    orderBy: { paid_at: 'asc' },
    select: {
      amount: true,
      payment_method: true,
      paid_at: true,
      voided_at: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

type ListRow = Prisma.InvoiceGetPayload<{ select: typeof LIST_SELECT }>;

/** Chưa thu đủ = unpaid hoặc partially_paid (trạng thái luôn được tính lại khi thu / huỷ phiếu) */
const NOT_PAID = {
  in: ['unpaid', 'partially_paid'],
} satisfies Prisma.EnumInvoiceStatusFilter;

/** Điều kiện của từng tab. Hoá đơn chỉ có từ lúc nhận phòng -> booking chỉ có thể checked_in / checked_out */
const TAB_WHERE: Record<InvoiceTab, Prisma.InvoiceWhereInput> = {
  all: {},
  open: { booking: { status: 'checked_in' } },
  debt: { booking: { status: 'checked_out' }, status: NOT_PAID },
  paid: { booking: { status: 'checked_out' }, status: 'paid' },
};

const METHODS = Object.values(PaymentMethod);

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  /* ============================================================
   *  DANH SÁCH
   * ============================================================ */

  async findAll(query: QueryInvoiceDto): Promise<PaginatedInvoiceResponseDto> {
    const {
      page = 1,
      limit = 20,
      tab = 'all',
      search,
      method,
      from,
      to,
      sort = 'created_at',
      order = 'desc',
    } = query;

    const and: Prisma.InvoiceWhereInput[] = [TAB_WHERE[tab]];

    if (method)
      and.push({
        payments: { some: { payment_method: method, voided_at: null } },
      });

    if (from || to) {
      if (from && to && from > to)
        throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
      const range = vnDayRange(from ?? '2000-01-01', to ?? '2999-12-31');
      and.push({
        created_at: {
          ...(from && { gte: range.gte }),
          ...(to && { lt: range.lt }),
        },
      });
    }

    if (search?.trim()) {
      // "HD-2609 Khoa" -> MỖI từ phải khớp ít nhất 1 field
      for (const token of search.trim().split(/\s+/).slice(0, 5)) {
        const compact = token.replace(/[\s.\-()]/g, '');
        and.push({
          booking: {
            OR: [
              {
                code: {
                  contains: searchTokenToBookingCode(token),
                  mode: 'insensitive',
                },
              },
              {
                customer: {
                  first_name: { contains: token, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  last_name: { contains: token, mode: 'insensitive' },
                },
              },
              ...(compact
                ? [{ customer: { phone: { contains: compact } } }]
                : []),
              {
                booking_rooms: {
                  some: { room: { room_number: { contains: token } } },
                },
              },
            ],
          },
        });
      }
    }

    const where: Prisma.InvoiceWhereInput = { AND: and };
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [
      { [sort]: order },
      { id: 'asc' },
    ];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toListItem(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ============================================================
   *  THỐNG KÊ
   * ============================================================ */

  async stats(query: InvoiceStatsQueryDto): Promise<InvoiceStatsDto> {
    // Bỏ trống -> tháng này (mùng 1 tới hôm nay); chỉ có `to` -> từ mùng 1 của tháng đó
    const to = query.to ?? todayYmd();
    const from = query.from ?? monthToDate(to).from;
    if (from > to)
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    if (nightsBetween(from, to) + 1 > MAX_STATS_DAYS) {
      throw new BadRequestException(
        `Chỉ thống kê tối đa ${MAX_STATS_DAYS} ngày một lần`,
      );
    }

    const range = vnDayRange(from, to);
    const prev = previousRange(from, to);
    const active = { voided_at: null } satisfies Prisma.PaymentWhereInput;

    const [payments, previous, voided, discount, unpaid, tabCounts] =
      await Promise.all([
        // Phiếu thu trong kỳ: 1 khách sạn nhỏ vài trăm phiếu / tháng -> gom bằng JS cho dễ đọc
        this.prisma.payment.findMany({
          where: { ...active, paid_at: range },
          select: { amount: true, payment_method: true, paid_at: true },
        }),
        this.prisma.payment.aggregate({
          where: { ...active, paid_at: vnDayRange(prev.from, prev.to) },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.payment.aggregate({
          where: { voided_at: range },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.invoice.aggregate({
          where: { created_at: range },
          _sum: { discount: true },
        }),
        // Hoá đơn còn thiếu tiền (đang ở + công nợ) để tính số còn phải thu
        this.prisma.invoice.findMany({
          where: { status: NOT_PAID },
          select: {
            final_amount: true,
            booking: { select: { status: true } },
            payments: {
              where: active,
              select: { amount: true, voided_at: true },
            },
          },
        }),
        Promise.all(
          (Object.keys(TAB_WHERE) as InvoiceTab[]).map((t) =>
            this.prisma.invoice.count({ where: TAB_WHERE[t] }),
          ),
        ),
      ]);

    // Theo phương thức: luôn đủ 4 dòng để FE vẽ cố định màu
    const byMethod = new Map(
      METHODS.map((m) => [m, { method: m, amount: 0, count: 0 }]),
    );
    for (const p of payments) {
      const row = byMethod.get(p.payment_method)!;
      row.amount += Number(p.amount);
      row.count++;
    }

    // Đang ở: mọi hoá đơn checked_in (kể cả đã tạm ứng đủ) ; công nợ: đã trả phòng còn thiếu
    const open = { count: tabCounts[1], amount: 0 };
    const debt = { count: 0, amount: 0 };
    for (const inv of unpaid) {
      const remaining = remainingOf(
        Number(inv.final_amount),
        activePaid(inv.payments),
      );
      if (inv.booking.status === 'checked_in') open.amount += remaining;
      else if (isDebt(inv.booking.status, remaining)) {
        debt.count++;
        debt.amount += remaining;
      }
    }

    const [all, openCount, debtCount, paidCount] = tabCounts;
    return {
      from,
      to,
      collected: {
        amount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
        count: payments.length,
      },
      previous: {
        amount: Number(previous._sum.amount ?? 0),
        count: previous._count,
      },
      by_method: [...byMethod.values()].sort((a, b) => b.amount - a.amount),
      daily: dailySeries(
        from,
        to,
        payments.map((p) => ({ at: p.paid_at, amount: Number(p.amount) })),
      ),
      open,
      debt,
      voided: { amount: Number(voided._sum.amount ?? 0), count: voided._count },
      discount_total: Number(discount._sum.discount ?? 0),
      tabs: { all, open: openCount, debt: debtCount, paid: paidCount },
    };
  }

  /* ============================================================
   *  CHI TIẾT
   * ============================================================ */

  findOne(id: string, viewer: Viewer): Promise<InvoiceDetailDto> {
    return loadInvoiceDetail(this.prisma, { id }, viewer);
  }

  /** Booking chưa nhận phòng thì chưa có hoá đơn -> 404 */
  findByBooking(bookingId: string, viewer: Viewer): Promise<InvoiceDetailDto> {
    return loadInvoiceDetail(this.prisma, { booking_id: bookingId }, viewer);
  }

  /* ============================================================
   *  HELPER
   * ============================================================ */

  private toListItem(r: ListRow): InvoiceListItemDto {
    const b = r.booking;
    const checkIn = toYmd(b.check_in_date);
    const checkOut = toYmd(b.check_out_date);
    const finalAmount = Number(r.final_amount);
    const active = r.payments.filter((p) => !p.voided_at);
    const paid = activePaid(active);
    const remaining = remainingOf(finalAmount, paid);

    return {
      id: r.id,
      code: invoiceCode(b.code),
      status: r.status,
      booking: {
        id: b.id,
        code: b.code,
        status: b.status,
        check_in_date: checkIn,
        check_out_date: checkOut,
        nights: nightsBetween(checkIn, checkOut),
      },
      customer: {
        id: b.customer.id,
        full_name: fullName(b.customer)!,
        phone: b.customer.phone,
        is_member: b.customer.account_id !== null,
      },
      rooms: b.booking_rooms.map((br) => br.room.room_number).sort(),
      total_amount: Number(r.total_amount),
      discount: Number(r.discount),
      final_amount: finalAmount,
      paid_amount: paid,
      remaining,
      is_debt: isDebt(b.status, remaining),
      methods: [...new Set(active.map((p) => p.payment_method))],
      last_paid_at: active.length ? active[active.length - 1].paid_at : null,
      created_at: r.created_at,
    };
  }
}
