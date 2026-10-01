import { Injectable } from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addDays,
  nightsBetween,
  todayYmd,
  toDate,
  toYmd,
} from '../booking/booking.rules';
import {
  activePaid,
  dailySeries,
  monthToDate,
  remainingOf,
  vnDayRange,
  vnYmd,
} from '../invoice/invoice.rules';
import { occupancyPct, overlapNights } from '../room-type/room-type.rules';
import {
  DashboardGuestDto,
  DashboardOverviewDto,
  GuestFlowDto,
  RateKpiDto,
} from './dto/dashboard-response.dto';

const LIST_LIMIT = 8;
const DAYS = 7;
/** Đặt phòng đã thật sự ở -> tính tiền phòng, ADR, công suất quá khứ */
const STAYED = ['checked_in', 'checked_out'] as const;
/** Đặt phòng còn giữ phòng -> công suất dự kiến */
const HOLDING = ['pending', 'confirmed', 'checked_in'] as const;

const GUEST_SELECT = {
  id: true,
  code: true,
  status: true,
  check_in_date: true,
  check_out_date: true,
  actual_check_in: true,
  actual_check_out: true,
  customer: { select: { first_name: true, last_name: true } },
  booking_rooms: {
    select: { room: { select: { room_number: true, status: true } } },
  },
} satisfies Prisma.BookingSelect;

type GuestRow = Prisma.BookingGetPayload<{ select: typeof GUEST_SELECT }>;
type RoomState = DashboardGuestDto['room_state'];

/**
 * Trang Tổng quan: CHỈ ĐỌC, gom mọi số liệu trong 1 request (truy vấn chạy song song).
 * "Đến / đi hôm nay" dùng cùng điều kiện với tab Đến / Đi của trang Đặt phòng -> số 2 trang luôn khớp.
 *
 * Phân biệt 2 loại "doanh thu":
 *   - Thực thu: tiền đã thu theo ngày thu (phiếu thu), gồm cả dịch vụ và tiền của những đêm trước
 *   - Tiền phòng: giá phòng của các ĐÊM đã bán -> dùng cho ADR, RevPAR (chuẩn ngành khách sạn)
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<DashboardOverviewDto> {
    const today = todayYmd();
    const t = toDate(today);
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    const todayRange = vnDayRange(today, today);
    const month = monthToDate(today);
    const monthDays = nightsBetween(month.from, today) + 1;
    // Cùng số ngày của tháng trước (1/8 – 30/8 so với 1/9 – 30/9); tháng trước ngắn hơn thì lấy hết tháng
    const prevLast = addDays(month.from, -1);
    const prevFrom = `${prevLast.slice(0, 8)}01`;
    const prevTo = minYmd(addDays(prevFrom, monthDays - 1), prevLast);
    const weekFrom = addDays(today, -(DAYS - 1));
    const stayFrom = minYmd(month.from, weekFrom);

    const sumPaid = (range: { gte: Date; lt: Date }) =>
      this.prisma.payment.aggregate({
        where: { voided_at: null, paid_at: range },
        _sum: { amount: true },
      });

    const [
      arrivalsTodo,
      arrivalsDone,
      departuresTodo,
      departuresDone,
      inHouse,
      rooms,
      paidToday,
      paidYesterday,
      paidMonth,
      paidPrev,
      payments,
      stayed,
      holding,
      createdToday,
      pending,
      debts,
      newCustomers,
      returning,
      members,
    ] = await Promise.all([
      // Còn phải nhận: đã xác nhận, ngày đến <= hôm nay (gồm khách trễ)
      this.prisma.booking.findMany({
        where: { status: 'confirmed', check_in_date: { lte: t } },
        orderBy: { check_in_date: 'asc' },
        select: GUEST_SELECT,
      }),
      this.prisma.booking.findMany({
        where: { status: { in: [...STAYED] }, actual_check_in: todayRange },
        orderBy: { actual_check_in: 'desc' },
        select: GUEST_SELECT,
      }),
      // Còn phải trả: đang ở, ngày đi <= hôm nay (gồm khách quá hạn)
      this.prisma.booking.findMany({
        where: { status: 'checked_in', check_out_date: { lte: t } },
        orderBy: { check_out_date: 'asc' },
        select: GUEST_SELECT,
      }),
      this.prisma.booking.findMany({
        where: { status: 'checked_out', actual_check_out: todayRange },
        orderBy: { actual_check_out: 'desc' },
        select: GUEST_SELECT,
      }),
      this.prisma.booking.findMany({
        where: { status: 'checked_in' },
        select: {
          adults: true,
          children: true,
          _count: { select: { booking_rooms: true } },
        },
      }),
      this.prisma.room.findMany({
        select: { room_number: true, status: true },
        orderBy: { room_number: 'asc' },
      }),
      sumPaid(todayRange),
      sumPaid(vnDayRange(yesterday, yesterday)),
      sumPaid(vnDayRange(month.from, today)),
      sumPaid(vnDayRange(prevFrom, prevTo)),
      // Phiếu thu từ đầu tháng / 7 ngày qua: thực thu theo ngày + theo nguồn đặt phòng
      this.prisma.payment.findMany({
        where: { voided_at: null, paid_at: vnDayRange(stayFrom, today) },
        select: {
          amount: true,
          paid_at: true,
          invoice: {
            select: {
              booking_id: true,
              booking: { select: { booking_type: true } },
            },
          },
        },
      }),
      // Đêm phòng đã bán giao với [đầu tháng hoặc 7 ngày trước, đêm nay]
      this.prisma.bookingRoom.findMany({
        where: {
          booking: {
            status: { in: [...STAYED] },
            check_in_date: { lt: toDate(tomorrow) },
            check_out_date: { gt: toDate(stayFrom) },
          },
        },
        select: {
          price_per_night: true,
          booking: {
            select: { status: true, check_in_date: true, check_out_date: true },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          status: { in: [...HOLDING] },
          check_in_date: { lt: toDate(addDays(today, DAYS)) },
          check_out_date: { gt: t },
        },
        select: {
          check_in_date: true,
          check_out_date: true,
          _count: { select: { booking_rooms: true } },
        },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { created_at: todayRange },
        _count: true,
      }),
      this.prisma.booking.count({ where: { status: 'pending' } }),
      this.prisma.invoice.findMany({
        where: {
          status: { in: ['unpaid', 'partially_paid'] },
          booking: { status: 'checked_out' },
        },
        select: {
          final_amount: true,
          payments: { select: { amount: true, voided_at: true } },
        },
      }),
      this.prisma.customer.count({
        where: { created_at: vnDayRange(month.from, today) },
      }),
      // Quay lại: có nhận phòng trong tháng này VÀ đã từng trả phòng trước tháng này
      this.prisma.customer.count({
        where: {
          AND: [
            {
              bookings: {
                some: {
                  status: { in: [...STAYED] },
                  actual_check_in: vnDayRange(month.from, today),
                },
              },
            },
            {
              bookings: {
                some: {
                  status: 'checked_out',
                  check_out_date: { lte: toDate(month.from) },
                },
              },
            },
          ],
        },
      }),
      this.prisma.customer.count({ where: { account_id: { not: null } } }),
    ]);

    /* ----- Phòng ----- */
    const count = {
      total: rooms.length,
      available: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      inactive: 0,
    };
    for (const r of rooms) count[r.status]++;
    const sellable = Math.max(
      0,
      count.total - count.inactive - count.maintenance,
    );

    const arrivals = flow(arrivalsTodo, arrivalsDone, today, 'in');
    const pendingArrivals = arrivalsTodo.map((b) =>
      roomState(b.booking_rooms.map((br) => br.room.status)),
    );
    const reservedToday = arrivalsTodo.reduce(
      (n, b) =>
        n +
        b.booking_rooms.filter((br) => br.room.status === 'available').length,
      0,
    );

    /* ----- Tiền phòng: đêm nay + từ đầu tháng + 7 đêm qua ----- */
    const nightsOf = (from: string, to: string) =>
      stayed.map((br) => ({
        n: overlapNights(
          toYmd(br.booking.check_in_date),
          toYmd(br.booking.check_out_date),
          from,
          to,
        ),
        price: Number(br.price_per_night),
      }));
    const rate = (from: string, to: string, days: number): RateKpiDto => {
      const list = nightsOf(from, to);
      const sold = list.reduce((s, x) => s + x.n, 0);
      const revenue = list.reduce((s, x) => s + x.n * x.price, 0);
      return {
        adr: sold ? Math.round(revenue / sold) : 0,
        revpar: sellable ? Math.round(revenue / (sellable * days)) : 0,
        room_revenue: revenue,
        rooms_sold: sold,
      };
    };
    // Đêm nay chỉ tính khách ĐANG ở (khách đã trả phòng sáng nay không còn ở đêm nay)
    const tonight = stayed.filter((br) => br.booking.status === 'checked_in');
    const tonightRevenue = tonight.reduce(
      (s, br) =>
        s +
        (overlapNights(
          toYmd(br.booking.check_in_date),
          toYmd(br.booking.check_out_date),
          today,
          tomorrow,
        )
          ? Number(br.price_per_night)
          : 0),
      0,
    );
    const tonightSold = tonight.filter((br) =>
      overlapNights(
        toYmd(br.booking.check_in_date),
        toYmd(br.booking.check_out_date),
        today,
        tomorrow,
      ),
    ).length;

    /* ----- 7 ngày qua: thực thu + công suất từng đêm ----- */
    const weekPayments = payments.filter((p) => vnYmd(p.paid_at) >= weekFrom);
    const daily = dailySeries(
      weekFrom,
      today,
      weekPayments.map((p) => ({ at: p.paid_at, amount: Number(p.amount) })),
    );
    const past7d = daily.map((d) => {
      const sold = nightsOf(d.date, addDays(d.date, 1)).reduce(
        (s, x) => s + x.n,
        0,
      );
      return {
        ...d,
        rooms_sold: sold,
        occupancy: occupancyPct(sold, sellable, 1),
      };
    });

    /* ----- Nguồn đặt phòng (thực thu tháng này) ----- */
    const monthPayments = payments.filter(
      (p) => vnYmd(p.paid_at) >= month.from,
    );
    const channels = (['online', 'walk_in'] as const).map((channel) => {
      const list = monthPayments.filter(
        (p) => p.invoice.booking.booking_type === channel,
      );
      return {
        channel,
        amount: list.reduce((s, p) => s + Number(p.amount), 0),
        bookings: new Set(list.map((p) => p.invoice.booking_id)).size,
      };
    });

    /* ----- Công suất 7 ngày tới ----- */
    const forecast = Array.from({ length: DAYS }, (_, i) => {
      const date = addDays(today, i);
      const booked = holding.reduce(
        (sum, b) =>
          toYmd(b.check_in_date) <= date && date < toYmd(b.check_out_date)
            ? sum + b._count.booking_rooms
            : sum,
        0,
      );
      return { date, booked, occupancy: occupancyPct(booked, sellable, 1) };
    });

    /* ----- Đặt phòng tạo hôm nay ----- */
    const byStatus = new Map(createdToday.map((g) => [g.status, g._count]));
    const c = (s: string) => byStatus.get(s as never) ?? 0;

    /* ----- Công nợ ----- */
    const debt = debts.reduce(
      (acc, inv) => {
        const rest = remainingOf(
          Number(inv.final_amount),
          activePaid(inv.payments),
        );
        return rest > 0
          ? { count: acc.count + 1, amount: acc.amount + rest }
          : acc;
      },
      { count: 0, amount: 0 },
    );

    return {
      today,
      arrivals,
      departures: flow(departuresTodo, departuresDone, today, 'out'),
      in_house: inHouse.length,
      in_house_rooms: inHouse.reduce((s, b) => s + b._count.booking_rooms, 0),
      rooms: {
        ...count,
        reserved_today: reservedToday,
        occupancy: occupancyPct(count.occupied, sellable, 1),
        cleaning_rooms: rooms
          .filter((r) => r.status === 'cleaning')
          .map((r) => r.room_number),
        maintenance_rooms: rooms
          .filter((r) => r.status === 'maintenance')
          .map((r) => r.room_number),
      },
      collected_today: Number(paidToday._sum.amount ?? 0),
      collected_yesterday: Number(paidYesterday._sum.amount ?? 0),
      collected_month: Number(paidMonth._sum.amount ?? 0),
      collected_prev_month: Number(paidPrev._sum.amount ?? 0),
      rate_today: {
        adr: tonightSold ? Math.round(tonightRevenue / tonightSold) : 0,
        revpar: sellable ? Math.round(tonightRevenue / sellable) : 0,
        room_revenue: tonightRevenue,
        rooms_sold: tonightSold,
      },
      rate_month: rate(month.from, tomorrow, monthDays),
      bookings_today: {
        total: createdToday.reduce((s, g) => s + g._count, 0),
        confirmed: c('confirmed') + c('checked_in') + c('checked_out'),
        pending: c('pending'),
        cancelled: c('cancelled') + c('no_show'),
      },
      channels_month: channels,
      guests: {
        in_house_guests: inHouse.reduce((s, b) => s + b.adults + b.children, 0),
        new_this_month: newCustomers,
        returning_this_month: returning,
        members,
      },
      past_7d: past7d,
      forecast_7d: forecast,
      alerts: {
        pending_requests: pending,
        rooms_cleaning: count.cleaning,
        rooms_maintenance: count.maintenance,
        ready_for_check_in: pendingArrivals.filter((s) => s === 'ready').length,
        not_ready_for_check_in: pendingArrivals.filter((s) => s !== 'ready')
          .length,
        arrivals_overdue: arrivals.items.filter((i) => i.overdue).length,
        departures_overdue: departuresTodo.filter(
          (b) => toYmd(b.check_out_date) < today,
        ).length,
        debt_count: debt.count,
        debt_amount: debt.amount,
      },
    };
  }
}

/* ============================================================ */

const minYmd = (a: string, b: string) => (a < b ? a : b);

/** Phòng của khách sắp đến đã sẵn sàng chưa: lấy trạng thái "tệ nhất" trong các phòng của đặt phòng */
function roomState(statuses: RoomStatus[]): RoomState {
  if (statuses.includes('occupied')) return 'occupied';
  if (statuses.includes('cleaning')) return 'cleaning';
  if (statuses.some((s) => s === 'maintenance' || s === 'inactive'))
    return 'blocked';
  return 'ready';
}

/** Còn phải làm xếp trước (trễ lên đầu), đã xong xếp sau; cắt còn LIST_LIMIT dòng */
function flow(
  todo: GuestRow[],
  done: GuestRow[],
  today: string,
  kind: 'in' | 'out',
): GuestFlowDto {
  const toItem = (b: GuestRow, isDone: boolean): DashboardGuestDto => {
    const checkIn = toYmd(b.check_in_date);
    const checkOut = toYmd(b.check_out_date);
    return {
      booking_id: b.id,
      code: b.code,
      customer_name: `${b.customer.last_name} ${b.customer.first_name}`.trim(),
      rooms: b.booking_rooms.map((br) => br.room.room_number).sort(),
      room_state:
        !isDone && kind === 'in'
          ? roomState(b.booking_rooms.map((br) => br.room.status))
          : 'ready',
      status: b.status,
      done: isDone,
      overdue: !isDone && (kind === 'in' ? checkIn : checkOut) < today,
      at: isDone
        ? kind === 'in'
          ? b.actual_check_in
          : b.actual_check_out
        : null,
      nights: nightsBetween(checkIn, checkOut),
    };
  };

  const items = [
    ...todo.map((b) => toItem(b, false)),
    ...done.map((b) => toItem(b, true)),
  ];
  return {
    total: items.length,
    done: done.length,
    items: items.slice(0, LIST_LIMIT),
  };
}
