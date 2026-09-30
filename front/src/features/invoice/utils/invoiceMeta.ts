/**
 * Nhãn, màu, icon và hàm thuần cho màn Hoá đơn.
 * File .ts (không có JSX) -> tách khỏi component, Fast Refresh vẫn chạy tốt.
 */
import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type {
  CreatedPreset,
  InvoiceStatus,
  PaymentMethod,
  RangePreset,
} from "../../../types/invoice";
import { addDays, todayYmd } from "../../booking/utils/format";

export {
  avatarColor,
  formatAmount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyShort,
  formatPhone,
  formatRange,
  initialsOfFullName,
  todayYmd,
} from "../../booking/utils/format";
export { percentChange } from "../../service/utils/serviceMeta";

/**
 * Thông tin in trên hoá đơn. Đổi theo khách sạn của bạn.
 * Sau này có trang Cài đặt thì lấy từ API thay vì hằng số.
 */
export const HOTEL_INFO = {
  name: "Aurélien Hotel",
  address: "12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
  phone: "028 3822 0000",
  email: "lienhe@aurelien.vn",
};

/* ============================ Trạng thái ============================ */

/**
 * Trạng thái HIỂN THỊ: hoá đơn chưa đủ của khách ĐÃ TRẢ PHÒNG là "Công nợ",
 * cần nổi bật hơn "Chưa thu" của khách đang ở (chưa tới lúc thu).
 * Màu lấy từ biến CSS (DESIGN.md mục 2.4), không chép hex vào .ts.
 */
export type DisplayStatus = InvoiceStatus | "debt";

export const displayStatus = (
  status: InvoiceStatus,
  isDebt: boolean,
): DisplayStatus => (isDebt ? "debt" : status);

export const STATUS_META: Record<DisplayStatus, { label: string; color: string }> = {
  unpaid: { label: "Chưa thu", color: "var(--color-navy-600)" },
  partially_paid: { label: "Thu một phần", color: "var(--color-gold-700)" },
  paid: { label: "Đã thu đủ", color: "var(--color-room-available)" },
  debt: { label: "Công nợ", color: "var(--color-room-occupied)" },
  cancelled: { label: "Đã huỷ", color: "var(--color-room-maintenance)" },
};

/** Màu thanh "Đã thu" trong bảng và drawer */
export const progressColor = (s: DisplayStatus) =>
  s === "debt"
    ? "var(--color-room-occupied)"
    : s === "paid"
      ? "var(--color-room-available)"
      : "var(--color-gold-500)";

/* ============================ Phương thức ============================ */

export const METHOD_META: Record<
  PaymentMethod,
  { label: string; short: string; icon: LucideIcon }
> = {
  cash: { label: "Tiền mặt", short: "Tiền mặt", icon: Banknote },
  bank_transfer: { label: "Chuyển khoản", short: "CK", icon: Landmark },
  e_wallet: { label: "Ví điện tử", short: "Ví", icon: Smartphone },
  credit_card: { label: "Thẻ", short: "Thẻ", icon: CreditCard },
};

export const METHODS = Object.keys(METHOD_META) as PaymentMethod[];

export const METHOD_FILTER_OPTIONS: { value: PaymentMethod | ""; label: string }[] =
  [
    { value: "", label: "Tất cả" },
    ...METHODS.map((m) => ({ value: m, label: METHOD_META[m].label })),
  ];

/* ============================ Khoảng ngày ============================ */

/** Mùng 1 của tháng chứa ngày `ymd` */
const monthStart = (ymd: string) => `${ymd.slice(0, 8)}01`;

/** Khoảng ngày của 1 lựa chọn nhanh, tính theo "hôm nay" giờ VN */
export function presetRange(
  preset: Exclude<RangePreset, "custom">,
  today = todayYmd(),
) {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: monthStart(today), to: today };
    case "last_month": {
      const lastDay = addDays(monthStart(today), -1);
      return { from: monthStart(lastDay), to: lastDay };
    }
  }
}

/** Lọc "Ngày lập" của bảng -> from/to gửi lên BE. '' = không lọc */
export function createdRange(preset: CreatedPreset) {
  return preset ? presetRange(preset) : null;
}

/** "01/09 – 30/09" hoặc "30/09" nếu 1 ngày */
export function rangeLabel(from: string, to: string) {
  const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  return from === to ? dm(from) : `${dm(from)} – ${dm(to)}`;
}

/**
 * Biểu đồ theo ngày: kỳ dài (> 62 ngày) thì gộp nhiều ngày thành 1 cột cho đỡ dày.
 * Trả về { label, from, to, amount } cho từng cột.
 */
export function bucketDaily(daily: { date: string; amount: number }[]) {
  const size = Math.max(1, Math.ceil(daily.length / 62));
  const out: { from: string; to: string; amount: number }[] = [];
  for (let i = 0; i < daily.length; i += size) {
    const chunk = daily.slice(i, i + size);
    out.push({
      from: chunk[0].date,
      to: chunk[chunk.length - 1].date,
      amount: chunk.reduce((s, d) => s + d.amount, 0),
    });
  }
  return { size, bars: out };
}

/** Mốc trục tung "đẹp": 0, 5 tr, 10 tr, 15 tr... đủ chứa giá trị lớn nhất */
export function niceMax(max: number) {
  if (max <= 0) return 1_000_000;
  const raw = max / 4; // 4 khoảng chia
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((m) => m * pow).find((s) => s >= raw) ??
    pow * 10;
  return step * 4;
}

/* ============================ Tiền ============================ */

/** Chuỗi người dùng gõ "1.250.000" -> 1250000. Không phải số -> 0 */
export const parseMoneyInput = (s: string) => Number(s.replace(/\D/g, "")) || 0;
