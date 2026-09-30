/**
 * Kiểu dữ liệu dịch vụ — khớp 1-1 với service-response.dto.ts ở BE.
 */
import type { Paginated } from "./customer";

export type { Paginated };
export type ServiceCategory = "food" | "laundry" | "minibar" | "surcharge" | "other";
export type ServiceUnit =
  | "turn"
  | "portion"
  | "kg"
  | "set"
  | "bottle"
  | "can"
  | "hour"
  | "day";
export type ServiceStatusFilter = "all" | "active" | "inactive";
export type ServiceSort = "usage" | "name" | "price" | "created_at";

/* ============================ Dữ liệu từ BE ============================ */

export interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  unit: ServiceUnit;
  price: number;
  is_active: boolean;
  usage_30d: number; // tổng SỐ LƯỢNG 30 ngày (41 kg, 86 suất...)
  revenue_30d: number;
  total_uses: number; // số lần có trong hoá đơn từ trước tới nay
  can_delete: boolean; // = total_uses === 0
  created_at: string;
  updated_at: string;
}

export interface ServiceUsageItem {
  id: string;
  name: string;
  unit: ServiceUnit;
  usage_30d: number;
  revenue_30d: number;
}

export interface ServiceStats {
  total: number;
  active: number;
  by_category: Record<ServiceCategory, number>;
  revenue_this_month: number;
  revenue_last_month: number;
  uses_30d: number;
  top: ServiceUsageItem[];
  unused: ServiceUsageItem[];
}

/* ============================ Dữ liệu FE gửi lên ============================ */

export interface ServiceFilters {
  page: number;
  limit: number;
  search: string;
  category: ServiceCategory | ""; // '' = tất cả
  status: ServiceStatusFilter;
  sort: ServiceSort;
  order: "asc" | "desc" | ""; // '' = thứ tự mặc định của kiểu sắp xếp
}

export interface ServiceInput {
  name: string;
  category: ServiceCategory;
  unit: ServiceUnit;
  price: number;
}

/* ============================ Nhãn hiển thị ============================ */

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  food: "Ăn uống",
  laundry: "Giặt ủi",
  minibar: "Minibar",
  surcharge: "Phụ thu",
  other: "Khác",
};

export const UNIT_LABELS: Record<ServiceUnit, string> = {
  turn: "lượt",
  portion: "suất",
  kg: "kg",
  set: "bộ",
  bottle: "chai",
  can: "lon",
  hour: "giờ",
  day: "ngày",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as ServiceCategory[];
export const UNITS = Object.keys(UNIT_LABELS) as ServiceUnit[];

/** Gộp sort + order thành 1 ô chọn */
export const SERVICE_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "usage:", label: "Dùng nhiều nhất" },
  { value: "name:", label: "Tên A → Z" },
  { value: "price:asc", label: "Giá thấp → cao" },
  { value: "price:desc", label: "Giá cao → thấp" },
  { value: "created_at:", label: "Mới thêm gần đây" },
];

export const SERVICE_STATUS_OPTIONS: {
  value: ServiceStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Đang bán" },
  { value: "inactive", label: "Ngừng bán" },
];
