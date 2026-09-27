/**
 * Hàm định dạng thuần (không state, không gọi API) cho trang khách hàng.
 * Tách riêng để bảng, ngăn hồ sơ và form dùng chung một cách hiển thị.
 */

/** "0909123456" -> "0909 123 456". Số nước ngoài (+44...) giữ nguyên */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return /^0\d{9}$/.test(phone)
    ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
    : phone;
}

/**
 * Nhận cả "YYYY-MM-DD" (cột ngày) lẫn ISO đầy đủ (cột thời điểm) -> "dd/mm/yyyy".
 * Chuỗi chỉ có ngày thì TÁCH TAY, không đưa qua new Date(): new Date("2026-09-26")
 * là 00:00 UTC, múi giờ âm (VD Mỹ) sẽ lùi thành ngày 25.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  return new Date(value).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "dd/mm" cho khoảng ngày ngắn gọn: 26/09 – 28/09 */
export function formatDayMonth(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

/** Thời điểm đầy đủ cho ghi chú: 14/07/2026 15:30 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "06/2025". Tự ghép chuỗi: toLocaleDateString('vi-VN') với tháng + năm ra "tháng 06, 2025" */
export function formatMonthYear(iso: string): string {
  const [day] = new Date(iso)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
    .split(" ");
  const [y, m] = day.split("-");
  return `${m}/${y}`;
}

const money = new Intl.NumberFormat("vi-VN");

/** 2400000 -> "2.400.000đ" */
export function formatMoney(amount: number): string {
  return `${money.format(amount)}đ`;
}

/** Số tiền rút gọn cho ô thống kê: 14200000 -> "14,2 tr", 850000 -> "850 N" */
export function formatMoneyShort(amount: number): string {
  if (amount >= 1_000_000_000)
    return `${(amount / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (amount >= 1_000_000)
    return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} N`;
  return money.format(amount);
}

export function formatNumber(n: number): string {
  return money.format(n);
}

/** "079203001234" -> "0792 •••• 1234": đủ để đối chiếu, không lộ toàn bộ khi màn hình bị nhìn trộm */
export function maskIdCard(idCard: string): string {
  if (idCard.length <= 6) return idCard;
  return `${idCard.slice(0, 4)} •••• ${idCard.slice(-4)}`;
}

/** Chữ viết tắt: họ (chữ đầu của last_name) + tên. "Trần Minh" + "Khoa" -> "TK" */
export function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim().split(/\s+/).pop()?.[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return (last + first).toUpperCase() || "?";
}

/** Màu nền avatar cố định theo id: cùng 1 khách luôn cùng 1 màu */
const AVATAR_COLORS = [
  { bg: "#E4ECF6", fg: "#264B7A" },
  { bg: "#F6EDD3", fg: "#8A6D1F" },
  { bg: "#E2F1EA", fg: "#16714F" },
  { bg: "#F3E4E8", fg: "#8C3A55" },
  { bg: "#ECE7F6", fg: "#5A4A86" },
  { bg: "#EEE9E0", fg: "#6B5B3E" },
];

export function avatarColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Bỏ khoảng trắng, dấu chấm, gạch: khớp cách BE chuẩn hoá */
export const normalizePhone = (v: string) => v.replace(/[\s.\-()]/g, "");
export const normalizeIdCard = (v: string) => v.replace(/\s/g, "").toUpperCase();
