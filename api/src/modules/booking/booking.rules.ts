/**
 * Luật nghiệp vụ của Booking, viết dạng HÀM THUẦN (pure function):
 *   - không gọi DB, không đọc giờ hệ thống bên trong (ngày "hôm nay" truyền vào)
 *   -> test được bằng unit test, không cần DB, chạy trong vài mili giây
 *
 * Service chỉ việc lấy dữ liệu rồi gọi các hàm ở đây. Sau này đổi luật
 * (vd tối đa 30 đêm -> 60 đêm) thì sửa 1 chỗ và test báo ngay nếu hỏng.
 *
 * Quy ước ngày: chuỗi "YYYY-MM-DD" theo giờ Việt Nam.
 * So sánh 2 chuỗi cùng định dạng này bằng < > cho kết quả đúng như so sánh ngày.
 */
import type { BookingStatus } from '@prisma/client';

export const HOTEL_TZ = 'Asia/Ho_Chi_Minh';

/** Trạng thái đang GIỮ phòng. Liệt kê thay vì loại trừ: thêm trạng thái mới thì mặc định không giữ phòng */
export const HOLDING_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
] as const satisfies readonly BookingStatus[];

export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;
export const MAX_PENDING_PER_CUSTOMER = 3;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/* ============================================================
 *  NGÀY THÁNG
 * ============================================================ */

/** "Hôm nay" theo giờ VN. Nhận `now` để test truyền giờ giả vào */
export const todayYmd = (now: Date = new Date()) =>
  now.toLocaleDateString('sv-SE', { timeZone: HOTEL_TZ });

/** "2026-09-29" -> Date 00:00 UTC, khớp cách Prisma đọc/ghi cột @db.Date */
export const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

/** Date của cột @db.Date -> "2026-09-29" */
export const toYmd = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (ymd: string, n: number) =>
  toYmd(new Date(toDate(ymd).getTime() + n * DAY_MS));

export const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.round((toDate(checkOut).getTime() - toDate(checkIn).getTime()) / DAY_MS);

/** Đúng định dạng VÀ là ngày có thật ("2026-02-30" -> false) */
export const isValidYmd = (s: string) =>
  YMD.test(s) && !Number.isNaN(toDate(s).getTime()) && toYmd(toDate(s)) === s;

/* ============================================================
 *  TRÙNG LỊCH
 * ============================================================ */

export interface StayRange {
  checkIn: string; // "YYYY-MM-DD"
  checkOut: string;
}

/**
 * 2 khoảng ở có giao nhau không. Khoảng NỬA MỞ [checkIn, checkOut):
 * khách A trả phòng 12:00 ngày 5, khách B nhận phòng 14:00 ngày 5 -> KHÔNG trùng.
 *
 *   A: |-----)
 *   B:       |-----)   a.out == b.in  -> không trùng
 *   B:     |-----)     a.out >  b.in  -> trùng
 */
export const rangesOverlap = (a: StayRange, b: StayRange) =>
  a.checkIn < b.checkOut && b.checkIn < a.checkOut;

/**
 * Tìm booking đầu tiên chặn khoảng ngày `range`.
 * Chỉ tính booking đang giữ phòng: đã huỷ / không đến / đã trả phòng thì bỏ qua.
 * Service dùng câu query cùng điều kiện; hàm này là bản "chuẩn" để unit test.
 */
export function findConflict<T extends StayRange & { status: BookingStatus }>(
  range: StayRange,
  existing: readonly T[],
): T | undefined {
  return existing.find(
    (b) =>
      (HOLDING_STATUSES as readonly BookingStatus[]).includes(b.status) &&
      rangesOverlap(range, b),
  );
}

/* ============================================================
 *  KIỂM TRA DỮ LIỆU ĐẶT PHÒNG
 * ============================================================ */

export interface StayInput extends StayRange {
  adults: number;
  children: number; // chỉ đếm trẻ từ 6 tuổi, dưới 6 tuổi không tính sức chứa
}

/**
 * Trả về câu báo lỗi đầu tiên (tiếng Việt), hợp lệ thì trả null.
 * Tách phần ngày và phần sức chứa: quote chỉ biết sức chứa sau khi đọc phòng từ DB.
 */
export function validateDates(input: StayRange, today: string): string | null {
  const { checkIn, checkOut } = input;

  if (!isValidYmd(checkIn) || !isValidYmd(checkOut))
    return 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD';
  if (checkIn < today) return 'Ngày nhận phòng không được ở quá khứ';
  if (checkOut <= checkIn) return 'Ngày trả phòng phải sau ngày nhận phòng';
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS)
    return `Mỗi lần đặt tối đa ${MAX_NIGHTS} đêm`;
  if (checkIn > addDays(today, MAX_ADVANCE_DAYS))
    return `Chỉ nhận đặt trước tối đa ${MAX_ADVANCE_DAYS} ngày`;

  return null;
}

export function validateGuests(
  input: Pick<StayInput, 'adults' | 'children'>,
  capacity: number,
): string | null {
  const { adults, children } = input;

  if (!Number.isInteger(adults) || adults < 1)
    return 'Phải có ít nhất 1 người lớn';
  if (!Number.isInteger(children) || children < 0)
    return 'Số trẻ em không hợp lệ';
  if (adults + children > capacity) {
    return `Phòng chỉ ở tối đa ${capacity} người (không tính trẻ dưới 6 tuổi)`;
  }
  return null;
}

/* ============================================================
 *  GIÁ & MÃ
 * ============================================================ */

/** Tiền phòng = số đêm x giá 1 đêm. Dịch vụ, giảm giá tính lúc trả phòng */
export function quoteStay(
  pricePerNight: number,
  checkIn: string,
  checkOut: string,
) {
  const nights = nightsBetween(checkIn, checkOut);
  return {
    nights,
    price_per_night: pricePerNight,
    room_total: nights * pricePerNight,
  };
}

/**
 * "BK-260929-0012": ngày tạo theo giờ VN + số lấy từ sequence booking_code_seq.
 * padStart KHÔNG cắt số: vượt 9999 thì thành 5 chữ số, không bao giờ trùng.
 */
export function bookingCode(createdAt: Date, seq: number | bigint): string {
  const ymd = todayYmd(createdAt).replace(/-/g, '').slice(2);
  return `BK-${ymd}-${String(seq).padStart(4, '0')}`;
}

/* ============================================================
 *  HÀNH ĐỘNG ĐƯỢC PHÉP
 * ============================================================ */

export const BOOKING_ACTIONS = [
  'confirm', // duyệt yêu cầu online
  'reject', // từ chối yêu cầu online
  'cancel', // huỷ (khách: đơn pending của mình; nhân viên: chỉ quản lý huỷ đơn đã xác nhận)
  'check_in',
  'mark_no_show',
  'add_service',
  'check_out',
] as const;
export type BookingAction = (typeof BOOKING_ACTIONS)[number];

const STAFF_ROLES = ['staff', 'manager', 'admin'];
const MANAGER_ROLES = ['manager', 'admin'];

/**
 * Nút nào được hiện cho booking này, với người dùng này, vào hôm nay.
 * FE dùng để ẩn/hiện nút; bước 3 các API hành động cũng gọi lại hàm này
 * -> FE và BE luôn cùng 1 luật, không lệch nhau.
 */
export function allowedActions(
  booking: { status: BookingStatus; checkIn: string; checkOut: string },
  roles: readonly string[],
  today: string,
): BookingAction[] {
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
  const isManager = roles.some((r) => MANAGER_ROLES.includes(r));
  const isCustomer = roles.includes('customer');
  const { status, checkIn, checkOut } = booking;

  const actions: BookingAction[] = [];

  switch (status) {
    case 'pending':
      if (isStaff) actions.push('confirm', 'reject');
      else if (isCustomer) actions.push('cancel');
      break;

    case 'confirmed':
      // Không nhận phòng sớm. Đến trễ (qua ngày nhận) vẫn cho nhận nếu chưa tới ngày trả
      if (isStaff && checkIn <= today && today < checkOut)
        actions.push('check_in');
      if (isStaff && checkIn < today) actions.push('mark_no_show');
      if (isManager) actions.push('cancel');
      break;

    case 'checked_in':
      if (isStaff) actions.push('add_service', 'check_out');
      break;

    // checked_out, cancelled, no_show: đã kết thúc, không làm gì thêm
  }

  return actions;
}
