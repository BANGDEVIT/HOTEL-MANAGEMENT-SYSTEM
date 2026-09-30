/**
 * Luật & phép tính của Loại phòng, viết dạng HÀM THUẦN (giống booking.rules):
 * không gọi DB, không đọc giờ hệ thống -> unit test chạy trong vài mili giây.
 * Quy ước ngày: chuỗi "YYYY-MM-DD", khoảng ở là NỬA MỞ [nhận phòng, trả phòng).
 */
import { nightsBetween } from '../booking/booking.rules';

/** Số đêm của khoảng ở [from, to) nằm trong cửa sổ [winFrom, winTo) */
export function overlapNights(
  from: string,
  to: string,
  winFrom: string,
  winTo: string,
): number {
  const start = from > winFrom ? from : winFrom;
  const end = to < winTo ? to : winTo;
  return end > start ? nightsBetween(start, end) : 0;
}

/**
 * Công suất (%) = đêm phòng đã bán / đêm phòng có thể bán.
 * Không có phòng nào kinh doanh -> 0 (không chia cho 0).
 */
export function occupancyPct(
  soldNights: number,
  sellableRooms: number,
  days: number,
): number {
  const capacity = sellableRooms * days;
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((soldNights / capacity) * 100));
}

/** 1 booking chưa kết thúc có dính tới loại phòng đang sửa */
export interface UpcomingBooking {
  guests: number; // người lớn + trẻ từ 6 tuổi
  roomsOfType: number; // số phòng thuộc loại này trong booking
  otherCapacity: number; // tổng sức chứa các phòng KHÁC loại trong cùng booking
}

/**
 * Sức chứa NHỎ NHẤT được phép đặt cho loại phòng mà mọi booking sắp tới vẫn đủ chỗ.
 * Booking k phòng loại này + phòng khác sức chứa O cần: k * c + O >= số khách
 *   -> c >= ceil((số khách - O) / k)
 * Không có booking nào -> 1.
 */
export function minCapacity(bookings: readonly UpcomingBooking[]): number {
  return bookings.reduce((min, b) => {
    if (b.roomsOfType <= 0) return min;
    return Math.max(
      min,
      Math.ceil((b.guests - b.otherCapacity) / b.roomsOfType),
    );
  }, 1);
}

export function capacityError(next: number, required: number): string | null {
  if (next >= required) return null;
  return `Đang có booking sắp tới cần mỗi phòng loại này chứa tối thiểu ${required} người. Không giảm sức chứa xuống ${next} được`;
}

/** So tên không phân biệt hoa thường, bỏ khoảng trắng thừa: "deluxe " trùng "Deluxe" */
export const normalizeName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();
