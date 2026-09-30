/**
 * Kiểu dữ liệu hoá đơn & phiếu thu — khớp 1-1 với invoice-response.dto.ts ở BE.
 * Ngày ở ("YYYY-MM-DD") và thời điểm (ISO) đi qua JSON đều là chuỗi.
 */
import type { BookingStatus, InvoiceStatus, PaymentMethod } from "./booking";
import type { Paginated } from "./customer";
import type { ServiceUnit } from "./service";

export type { InvoiceStatus, Paginated, PaymentMethod };
export type InvoiceTab = "all" | "open" | "debt" | "paid";
export type InvoiceSort = "created_at" | "final_amount";
export type InvoiceAction = "collect" | "void_payment" | "print";

/** Kỳ thống kê ở đầu trang */
export type RangePreset = "today" | "7d" | "month" | "last_month" | "custom";
/** Lọc "Ngày lập" của bảng. '' = mọi lúc */
export type CreatedPreset = "" | "today" | "7d" | "month" | "last_month";

/* ============================ Danh sách ============================ */

export interface InvoiceBookingBrief {
  id: string;
  code: string;
  status: BookingStatus;
  check_in_date: string;
  check_out_date: string;
  nights: number;
}

export interface InvoiceCustomerBrief {
  id: string;
  full_name: string;
  phone: string | null;
  is_member: boolean;
}

export interface InvoiceListItem {
  id: string;
  code: string; // "HD-260929-0012"
  status: InvoiceStatus;
  booking: InvoiceBookingBrief;
  customer: InvoiceCustomerBrief;
  rooms: string[];
  total_amount: number;
  discount: number;
  final_amount: number;
  paid_amount: number; // phiếu đã huỷ không tính
  remaining: number;
  is_debt: boolean; // đã trả phòng mà còn thiếu
  methods: PaymentMethod[];
  last_paid_at: string | null;
  created_at: string;
}

/* ============================ Thống kê ============================ */

export interface AmountCount {
  amount: number;
  count: number;
}

export interface InvoiceStats {
  from: string;
  to: string;
  collected: AmountCount; // thực thu trong kỳ
  previous: AmountCount; // kỳ liền trước cùng số ngày
  by_method: (AmountCount & { method: PaymentMethod })[]; // luôn đủ 4, tiền nhiều trước
  daily: { date: string; amount: number }[];
  open: AmountCount; // khách đang ở: số còn phải thu
  debt: AmountCount; // công nợ, không phụ thuộc kỳ
  voided: AmountCount; // phiếu huỷ trong kỳ
  discount_total: number;
  tabs: Record<InvoiceTab, number>;
}

/* ============================ Chi tiết ============================ */

export interface InvoiceRoomLine {
  room_number: string;
  room_type: string;
  nights: number;
  price_per_night: number;
  amount: number;
}

export interface InvoiceServiceLine {
  id: string;
  name: string;
  unit: ServiceUnit;
  quantity: number;
  unit_price: number;
  total_price: number;
  used_at: string;
  note: string | null;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  note: string | null;
  paid_at: string;
  received_by: string | null;
  voided: { at: string; by: string | null; reason: string | null } | null; // null = còn hiệu lực
  can_void: boolean;
}

export interface InvoiceDetail {
  id: string;
  code: string;
  status: InvoiceStatus;
  booking: InvoiceBookingBrief & {
    booking_type: "online" | "walk_in";
    adults: number;
    children: number;
    actual_check_in: string | null;
    actual_check_out: string | null;
    checked_out_by: string | null;
  };
  customer: InvoiceCustomerBrief & {
    email: string | null;
    nationality: string | null;
  };
  rooms: InvoiceRoomLine[];
  services: InvoiceServiceLine[];
  room_total: number;
  service_total: number;
  total_amount: number;
  discount: number;
  final_amount: number;
  paid_amount: number;
  remaining: number;
  is_debt: boolean;
  payments: InvoicePayment[]; // cũ trước, mới sau, gồm cả phiếu đã huỷ
  allowed_actions: InvoiceAction[];
  created_at: string;
  updated_at: string;
}

/* ============================ Dữ liệu FE gửi lên ============================ */

export interface InvoiceFilters {
  page: number;
  limit: number;
  tab: InvoiceTab;
  search: string;
  method: PaymentMethod | "";
  created: CreatedPreset;
  sort: InvoiceSort;
  order: "asc" | "desc";
}

export interface StatsRange {
  preset: RangePreset;
  from: string;
  to: string;
}

export interface CollectPaymentInput {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  note?: string;
}

/* ============================ Nhãn hiển thị ============================ */

export const INVOICE_TAB_LABELS: Record<InvoiceTab, string> = {
  all: "Tất cả",
  open: "Đang ở",
  debt: "Công nợ",
  paid: "Đã thu đủ",
};

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Hôm nay",
  "7d": "7 ngày",
  month: "Tháng này",
  last_month: "Tháng trước",
  custom: "Tuỳ chọn",
};

export const CREATED_OPTIONS: { value: CreatedPreset; label: string }[] = [
  { value: "", label: "Mọi lúc" },
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày qua" },
  { value: "month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
];

/** Gộp sort + order thành 1 ô chọn */
export const INVOICE_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_at:desc", label: "Mới lập gần đây" },
  { value: "created_at:asc", label: "Cũ nhất trước" },
  { value: "final_amount:desc", label: "Tiền nhiều nhất" },
  { value: "final_amount:asc", label: "Tiền ít nhất" },
];

/** Chuyển khoản / ví điện tử bắt buộc mã giao dịch (giống BE) */
export const NEEDS_REFERENCE: PaymentMethod[] = ["bank_transfer", "e_wallet"];
export const MIN_PAYMENT = 1_000;
