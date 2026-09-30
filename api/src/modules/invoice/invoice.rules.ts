/**
 * Luật nghiệp vụ của Hoá đơn & Phiếu thu, viết dạng HÀM THUẦN giống booking.rules:
 * không gọi DB, không đọc giờ hệ thống -> unit test chạy trong vài mili giây.
 *
 * Quy ước tiền: số nguyên VND. Quy ước ngày: chuỗi "YYYY-MM-DD" theo giờ Việt Nam.
 */
import type {
  BookingStatus,
  InvoiceStatus,
  PaymentMethod,
} from '@prisma/client';
import { addDays, HOTEL_TZ, nightsBetween } from '../booking/booking.rules';

/* ============================================================
 *  SỐ TIỀN & TRẠNG THÁI
 * ============================================================ */

/** Tổng tiền các phiếu thu CÒN HIỆU LỰC (phiếu đã huỷ không tính) */
export function activePaid(
  payments: readonly {
    amount: number | { toString(): string };
    voided_at: Date | null;
  }[],
): number {
  return payments.reduce(
    (sum, p) => (p.voided_at ? sum : sum + Number(p.amount)),
    0,
  );
}

/**
 * Trạng thái hoá đơn suy ra từ số tiền, KHÔNG tự đặt bằng tay:
 *   đã thu >= phải trả -> paid (kể cả hoá đơn 0đ do giảm giá 100%)
 *   đã thu > 0         -> partially_paid
 *   chưa thu gì        -> unpaid
 */
export function invoiceStatusFor(
  finalAmount: number,
  paidAmount: number,
): Exclude<InvoiceStatus, 'cancelled'> {
  if (paidAmount >= finalAmount) return 'paid';
  if (paidAmount > 0) return 'partially_paid';
  return 'unpaid';
}

export const remainingOf = (finalAmount: number, paidAmount: number) =>
  Math.max(0, finalAmount - paidAmount);

/** Công nợ = khách ĐÃ trả phòng mà hoá đơn còn thiếu (thường do huỷ phiếu thu sau khi trả phòng) */
export const isDebt = (bookingStatus: BookingStatus, remaining: number) =>
  bookingStatus === 'checked_out' && remaining > 0;

/**
 * Đổi dịch vụ / giảm giá làm tổng phải trả THẤP HƠN số đã thu -> chặn.
 * Không tự hoàn tiền: quản lý huỷ phiếu thu thừa rồi thu lại đúng số.
 */
export function belowPaidError(
  finalAmount: number,
  paidAmount: number,
): string | null {
  if (finalAmount >= paidAmount) return null;
  return (
    `Đã thu ${vnd(paidAmount)}, tổng phải trả sau thay đổi (${vnd(finalAmount)}) không được thấp hơn số đã thu. ` +
    'Nhờ quản lý huỷ phiếu thu thừa trước'
  );
}

/* ============================================================
 *  MÃ HOÁ ĐƠN
 * ============================================================ */

/**
 * 1 booking có đúng 1 hoá đơn -> số hoá đơn lấy luôn từ mã booking, không cần cột mới:
 * "BK-260929-0012" -> "HD-260929-0012". Nhìn số hoá đơn là biết booking nào.
 */
export const invoiceCode = (bookingCode: string) =>
  bookingCode.replace(/^BK-/, 'HD-');

/** Ô tìm kiếm: gõ số hoá đơn "HD-2609..." thì đổi sang mã booking để tìm */
export const searchTokenToBookingCode = (token: string) =>
  token.replace(/^hd-?/i, 'BK-');

/* ============================================================
 *  THU TIỀN
 * ============================================================ */

/** Tạm ứng khi đang ở, hoặc thu nợ sau khi đã trả phòng */
const COLLECTABLE: readonly BookingStatus[] = ['checked_in', 'checked_out'];

/** Chuyển khoản / ví điện tử phải có mã giao dịch để đối soát sao kê */
export const NEEDS_REFERENCE: readonly PaymentMethod[] = [
  'bank_transfer',
  'e_wallet',
];

export const MIN_PAYMENT = 1_000;

/** Trả về câu báo lỗi đầu tiên, hợp lệ thì null */
export function paymentError(input: {
  bookingStatus: BookingStatus;
  remaining: number;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
}): string | null {
  const { bookingStatus, remaining, amount, method, reference } = input;

  if (!COLLECTABLE.includes(bookingStatus)) {
    return 'Chỉ thu tiền khi khách đang ở hoặc đã trả phòng còn nợ';
  }
  if (remaining <= 0) return 'Hoá đơn đã thu đủ';
  if (!Number.isInteger(amount) || amount < MIN_PAYMENT)
    return `Số tiền tối thiểu ${vnd(MIN_PAYMENT)}`;
  if (amount > remaining)
    return `Số tiền thu (${vnd(amount)}) vượt quá số còn phải trả (${vnd(remaining)})`;
  if (NEEDS_REFERENCE.includes(method) && !reference?.trim()) {
    return 'Chuyển khoản và ví điện tử bắt buộc nhập mã giao dịch';
  }
  return null;
}

/* ============================================================
 *  HUỶ PHIẾU THU
 * ============================================================ */

const STAFF_ROLES = ['staff', 'manager', 'admin'];
const MANAGER_ROLES = ['manager', 'admin'];

export const isStaff = (roles: readonly string[]) =>
  roles.some((r) => STAFF_ROLES.includes(r));
export const isManager = (roles: readonly string[]) =>
  roles.some((r) => MANAGER_ROLES.includes(r));

/**
 * Huỷ phiếu thu nhập nhầm (sai số tiền, sai phương thức, chuyển khoản không về).
 *   403: không phải quản lý
 *   400: phiếu đã huỷ rồi
 */
export function voidError(
  payment: { voided_at: Date | null },
  roles: readonly string[],
): { status: 400 | 403; message: string } | null {
  if (!isManager(roles))
    return { status: 403, message: 'Chỉ quản lý được huỷ phiếu thu' };
  if (payment.voided_at)
    return { status: 400, message: 'Phiếu thu này đã huỷ trước đó' };
  return null;
}

/* ============================================================
 *  NÚT ĐƯỢC HIỆN (FE dùng, BE kiểm tra lại cùng luật)
 * ============================================================ */

export const INVOICE_ACTIONS = ['collect', 'void_payment', 'print'] as const;
export type InvoiceAction = (typeof INVOICE_ACTIONS)[number];

export function invoiceActions(
  invoice: {
    bookingStatus: BookingStatus;
    remaining: number;
    activePayments: number;
  },
  roles: readonly string[],
): InvoiceAction[] {
  const actions: InvoiceAction[] = [];
  if (
    isStaff(roles) &&
    COLLECTABLE.includes(invoice.bookingStatus) &&
    invoice.remaining > 0
  ) {
    actions.push('collect');
  }
  if (isManager(roles) && invoice.activePayments > 0)
    actions.push('void_payment');
  actions.push('print'); // khách cũng in / lưu PDF hoá đơn của mình được
  return actions;
}

/* ============================================================
 *  KHOẢNG NGÀY CHO THỐNG KÊ
 * ============================================================ */

export const MAX_STATS_DAYS = 366;

/** "Tháng này": từ mùng 1 tới hôm nay */
export function monthToDate(today: string) {
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** Kỳ liền trước, cùng số ngày: [1/9..30/9] -> [2/8..31/8] */
export function previousRange(from: string, to: string) {
  const days = nightsBetween(from, to) + 1;
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/** 00:00 giờ VN của ngày "YYYY-MM-DD" -> mốc thời gian để lọc cột DateTime */
export const vnStartOfDay = (ymd: string) => new Date(`${ymd}T00:00:00+07:00`);

/** Khoảng [from 00:00, to+1 00:00) theo giờ VN */
export const vnDayRange = (from: string, to: string) => ({
  gte: vnStartOfDay(from),
  lt: vnStartOfDay(addDays(to, 1)),
});

/** Mốc thời gian -> ngày "YYYY-MM-DD" theo giờ VN */
export const vnYmd = (d: Date) =>
  d.toLocaleDateString('sv-SE', { timeZone: HOTEL_TZ });

/** Doanh thu từng ngày, ngày không có phiếu thu vẫn có dòng 0 để biểu đồ liền mạch */
export function dailySeries(
  from: string,
  to: string,
  rows: readonly { at: Date; amount: number }[],
) {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d = vnYmd(r.at);
    byDay.set(d, (byDay.get(d) ?? 0) + r.amount);
  }
  const out: { date: string; amount: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1))
    out.push({ date: d, amount: byDay.get(d) ?? 0 });
  return out;
}

/* ============================================================ */

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
