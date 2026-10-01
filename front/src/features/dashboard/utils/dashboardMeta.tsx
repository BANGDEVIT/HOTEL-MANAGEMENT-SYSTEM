/**
 * Hàm thuần cho trang Tổng quan. File .ts (không JSX) -> Fast Refresh chạy tốt.
 */
export { formatMoney, formatMoneyShort } from "../../customer/utils/format";
export { percentChange } from "../../service/utils/serviceMeta";

const VN_TZ = "Asia/Ho_Chi_Minh";

/**
 * Đường dẫn các trang. Đổi ở đây nếu router của bạn đặt khác.
 */
export const ROUTES = {
  bookings: "/admin/bookings",
  invoices: "/admin/invoices",
  rooms: "/admin/rooms",
};

/**
 * Link sang trang Phòng lọc sẵn 1 trạng thái: /admin/rooms?status=cleaning
 * (trang Phòng cần đọc ?status từ URL, xem hướng dẫn kèm theo)
 */
export const roomsLink = (
  status: "available" | "occupied" | "cleaning" | "maintenance" | "inactive",
) => `${ROUTES.rooms}?status=${status}`;

/** "Chào buổi sáng / chiều / tối" theo giờ VN */
export function greeting(now = new Date()) {
  const h = Number(
    now.toLocaleString("en-US", { timeZone: VN_TZ, hour: "numeric", hour12: false }),
  );
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** "Thứ Tư, 30/09/2026" */
export const longDate = (now = new Date()) =>
  now.toLocaleDateString("vi-VN", {
    timeZone: VN_TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** "2026-09-30" -> "30/09" */
export const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** "2026-10-01" -> "T5" (thứ trong tuần, ngắn) */
export function weekdayShort(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return d === 0 ? "CN" : `T${d + 1}`;
}

/** Giờ ngắn "14:05" */
export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: VN_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
