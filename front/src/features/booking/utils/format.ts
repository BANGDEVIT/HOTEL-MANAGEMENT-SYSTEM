/**
 * Định dạng cho màn Đặt phòng. Phần dùng chung (SĐT, tiền, ngày, avatar) lấy lại
 * từ module Khách hàng -> 2 màn hiển thị giống hệt nhau, sửa 1 chỗ.
 */
import type {
  BookingDetail,
  BookingListItem,
  BookingStatus,
} from "../../../types/booking";
import type { IdType } from "../../../types/customer";

export {
  avatarColor,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  formatPhone,
  normalizeIdCard,
} from "../../customer/utils/format";

const VN_TZ = "Asia/Ho_Chi_Minh";
const money = new Intl.NumberFormat("vi-VN");

/** Số tiền không kèm "đ" cho cột bảng: 2.400.000 */
export const formatAmount = (n: number) => money.format(n);

/** "Hôm nay" theo giờ VN, dạng "2026-09-29" (giống BE) */
export const todayYmd = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: VN_TZ });

/** Cộng ngày trên chuỗi "YYYY-MM-DD", tính bằng UTC để không lệch múi giờ */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const nightsBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );

/** "28/09 – 30/09" (cùng năm) hoặc "28/12/2026 – 02/01/2027" */
export function formatRange(from: string, to: string): string {
  const [y1, m1, d1] = from.split("-");
  const [y2, m2, d2] = to.split("-");
  return y1 === y2
    ? `${d1}/${m1} – ${d2}/${m2}`
    : `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
}

/** Giờ ngắn: "14:08" */
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: VN_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });

/** "2 NL · 1 TE" */
export const formatGuests = (adults: number, children: number) =>
  children ? `${adults} NL · ${children} TE` : `${adults} NL`;

/** Chữ viết tắt từ họ tên đầy đủ: "Trần Minh Khoa" -> "TK" */
export function initialsOfFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Màu + nhãn trạng thái. Màu lấy từ biến CSS (DESIGN.md mục 2.4), không chép hex vào .ts.
 */
export const STATUS_META: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: "Chờ xác nhận", color: "var(--color-gold-700)" },
  confirmed: { label: "Đã xác nhận", color: "var(--color-navy-700)" },
  checked_in: { label: "Đang ở", color: "var(--color-room-available)" },
  checked_out: { label: "Đã trả phòng", color: "var(--color-room-maintenance)" },
  cancelled: { label: "Đã huỷ", color: "var(--color-room-occupied)" },
  no_show: { label: "Không đến", color: "var(--color-room-inactive)" },
};

/** Trễ bao nhiêu ngày so với ngày đến (confirmed) hoặc ngày đi (checked_in) */
export function overdueDays(
  b: Pick<BookingListItem, "status" | "check_in_date" | "check_out_date">,
): number {
  const today = todayYmd();
  if (b.status === "confirmed")
    return Math.max(0, nightsBetween(b.check_in_date, today));
  if (b.status === "checked_in")
    return Math.max(0, nightsBetween(b.check_out_date, today));
  return 0;
}

/** Phụ đề chung của mọi hộp thoại: "BK-260929-0012 · Trần Minh Khoa · 29/09 – 02/10 · Phòng 302" */
export const bookingSubtitle = (b: BookingDetail) =>
  [
    b.code,
    b.customer.full_name,
    formatRange(b.check_in_date, b.check_out_date),
    b.room && `Phòng ${b.room.room_number}`,
  ]
    .filter(Boolean)
    .join(" · ");

/** Kiểm tra số giấy tờ, giống luật BE: CCCD 12 số, hộ chiếu 6–12 chữ in hoa + số */
export function idCardError(type: IdType | "", card: string): string | null {
  if (!card) return "Nhập số giấy tờ";
  if (!type) return "Chọn loại giấy tờ";
  if (type === "cccd" && !/^\d{12}$/.test(card)) return "Số CCCD gồm đúng 12 chữ số";
  if (type === "passport" && !/^[A-Z0-9]{6,12}$/.test(card))
    return "Số hộ chiếu gồm 6–12 chữ và số";
  return null;
}
