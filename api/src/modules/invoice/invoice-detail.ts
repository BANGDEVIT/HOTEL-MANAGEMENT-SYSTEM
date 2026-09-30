import { NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { nightsBetween, toYmd } from '../booking/booking.rules';
import type { InvoiceDetailDto } from './dto/invoice-response.dto';
import {
  activePaid,
  invoiceActions,
  invoiceCode,
  isDebt,
  isStaff,
  remainingOf,
  voidError,
} from './invoice.rules';

/**
 * Đọc CHI TIẾT 1 hoá đơn. Để ở file riêng (hàm thường, nhận prisma làm tham số) vì
 * cả InvoiceService lẫn PaymentService đều cần: thu tiền / huỷ phiếu xong trả về
 * chi tiết mới nhất -> FE thay luôn, không phải gọi lại. Không cần sửa module để
 * 2 service gọi chéo nhau.
 */

/** Người đang xem: lấy từ token */
export interface Viewer {
  accountId: string;
  roles: string[];
}

type Db = PrismaClient | Prisma.TransactionClient;

const NAME = { select: { first_name: true, last_name: true } } as const;

export const fullName = (
  p: { first_name: string; last_name: string } | null | undefined,
) => (p ? `${p.last_name} ${p.first_name}`.trim() : null);

const DETAIL_SELECT = {
  id: true,
  status: true,
  total_amount: true,
  discount: true,
  final_amount: true,
  created_at: true,
  updated_at: true,
  booking: {
    select: {
      id: true,
      code: true,
      status: true,
      booking_type: true,
      check_in_date: true,
      check_out_date: true,
      adults: true,
      children: true,
      actual_check_in: true,
      actual_check_out: true,
      check_out_staff: NAME,
      customer: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
          nationality: true,
          account_id: true,
        },
      },
      booking_rooms: {
        orderBy: { room: { room_number: 'asc' } },
        select: {
          price_per_night: true,
          room: {
            select: {
              room_number: true,
              room_type: { select: { name: true } },
            },
          },
        },
      },
      booking_services: {
        orderBy: { used_at: 'asc' },
        select: {
          id: true,
          quantity: true,
          unit_price: true,
          total_price: true,
          used_at: true,
          note: true,
          service: { select: { name: true, unit: true } },
        },
      },
    },
  },
  payments: {
    orderBy: { paid_at: 'asc' },
    select: {
      id: true,
      amount: true,
      payment_method: true,
      reference_number: true,
      note: true,
      paid_at: true,
      voided_at: true,
      void_reason: true,
      receiver: NAME,
      voider: NAME,
    },
  },
} satisfies Prisma.InvoiceSelect;

type DetailRow = Prisma.InvoiceGetPayload<{ select: typeof DETAIL_SELECT }>;

/**
 * Khách (không phải nhân viên) chỉ xem được hoá đơn của chính mình.
 * Không phải của mình -> 404 như không tồn tại, không lộ ra là hoá đơn có thật.
 */
export async function loadInvoiceDetail(
  db: Db,
  where: Prisma.InvoiceWhereUniqueInput,
  viewer: Viewer,
): Promise<InvoiceDetailDto> {
  const row = await db.invoice.findUnique({ where, select: DETAIL_SELECT });
  if (!row) throw new NotFoundException('Không tìm thấy hoá đơn');

  if (
    !isStaff(viewer.roles) &&
    row.booking.customer.account_id !== viewer.accountId
  ) {
    throw new NotFoundException('Không tìm thấy hoá đơn');
  }

  return toInvoiceDetail(row, viewer.roles);
}

function toInvoiceDetail(r: DetailRow, roles: string[]): InvoiceDetailDto {
  const b = r.booking;
  const staffView = isStaff(roles);
  const staff = (p: { first_name: string; last_name: string } | null) =>
    staffView ? fullName(p) : null;

  const checkIn = toYmd(b.check_in_date);
  const checkOut = toYmd(b.check_out_date);
  const nights = nightsBetween(checkIn, checkOut);

  const rooms = b.booking_rooms.map((br) => ({
    room_number: br.room.room_number,
    room_type: br.room.room_type.name,
    nights,
    price_per_night: Number(br.price_per_night),
    amount: Number(br.price_per_night) * nights,
  }));
  const services = b.booking_services.map((s) => ({
    id: s.id,
    name: s.service.name,
    unit: s.service.unit,
    quantity: s.quantity,
    unit_price: Number(s.unit_price),
    total_price: Number(s.total_price),
    used_at: s.used_at,
    note: s.note,
  }));

  const finalAmount = Number(r.final_amount);
  const paid = activePaid(r.payments);
  const remaining = remainingOf(finalAmount, paid);
  const activePayments = r.payments.filter((p) => !p.voided_at).length;

  return {
    id: r.id,
    code: invoiceCode(b.code),
    status: r.status,
    booking: {
      id: b.id,
      code: b.code,
      status: b.status,
      booking_type: b.booking_type,
      check_in_date: checkIn,
      check_out_date: checkOut,
      nights,
      adults: b.adults,
      children: b.children,
      actual_check_in: b.actual_check_in,
      actual_check_out: b.actual_check_out,
      checked_out_by: staff(b.check_out_staff),
    },
    customer: {
      id: b.customer.id,
      full_name: fullName(b.customer)!,
      phone: b.customer.phone,
      email: b.customer.email,
      nationality: b.customer.nationality,
      is_member: b.customer.account_id !== null,
    },
    rooms,
    services,
    room_total: rooms.reduce((sum, x) => sum + x.amount, 0),
    service_total: services.reduce((sum, x) => sum + x.total_price, 0),
    total_amount: Number(r.total_amount),
    discount: Number(r.discount),
    final_amount: finalAmount,
    paid_amount: paid,
    remaining,
    is_debt: isDebt(b.status, remaining),
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      note: p.note,
      paid_at: p.paid_at,
      received_by: staff(p.receiver),
      voided: p.voided_at
        ? { at: p.voided_at, by: staff(p.voider), reason: p.void_reason }
        : null,
      can_void: voidError(p, roles) === null,
    })),
    allowed_actions: invoiceActions(
      { bookingStatus: b.status, remaining, activePayments },
      roles,
    ),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
