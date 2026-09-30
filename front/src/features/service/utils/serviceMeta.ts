/**
 * Icon + màu cho từng nhóm dịch vụ, và hàm định dạng dùng chung trong màn Dịch vụ.
 * File .ts (không có JSX) -> tách khỏi component, Fast Refresh vẫn chạy tốt.
 */
import {
  GlassWater,
  ReceiptText,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  UNIT_LABELS,
  type ServiceCategory,
  type ServiceUnit,
} from "../../../types/service";

export { formatMoneyShort, formatNumber } from "../../customer/utils/format";

/** Màu lấy từ biến CSS (DESIGN.md mục 2.4), không chép hex vào .ts */
export const CATEGORY_META: Record<
  ServiceCategory,
  { icon: LucideIcon; color: string }
> = {
  food: { icon: UtensilsCrossed, color: "var(--color-gold-700)" },
  laundry: { icon: Shirt, color: "var(--color-navy-700)" },
  minibar: { icon: GlassWater, color: "var(--color-shift-night)" },
  surcharge: { icon: ReceiptText, color: "var(--color-room-occupied)" },
  other: { icon: Sparkles, color: "var(--color-room-maintenance)" },
};

const money = new Intl.NumberFormat("vi-VN");

/** 50000 -> "50.000" */
export const formatAmount = (n: number) => money.format(n);

/** 41, 'kg' -> "41 kg" */
export const formatQty = (n: number, unit: ServiceUnit) =>
  `${money.format(n)} ${UNIT_LABELS[unit]}`;

/** % thay đổi so với kỳ trước. Kỳ trước = 0 thì không so được -> null */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
