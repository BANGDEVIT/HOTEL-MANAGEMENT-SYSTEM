/**
 * Kiểu dữ liệu đặt phòng — khớp 1-1 với booking-response.dto.ts ở BE.
 * Ngày ở ("YYYY-MM-DD") và thời điểm (ISO) đi qua JSON đều là chuỗi.
 */
import type { BookingStatus, IdType } from "./customer";

export type { BookingStatus } from "./customer";
export type BookingType = "online" | "walk_in";
export type BookingTab =
  | "all"
  | "pending"
  | "arrivals"
  | "in_house"
  | "departures"
  | "upcoming"
  | "history";
export type BookingSort = "created_at" | "check_in_date" | "check_out_date";
export type PaymentMethod = "cash" | "bank_transfer" | "e_wallet" | "credit_card";
export type InvoiceStatus = "unpaid" | "paid" | "partially_paid" | "cancelled";

export type BookingAction =
  | "confirm"
  | "reject"
  | "cancel"
  | "check_in"
  | "mark_no_show"
  | "add_service"
  | "set_discount"
  | "check_out";

/* ============================ Dữ liệu từ BE ============================ */

export interface BookingCustomer {
  id: string;
  full_name: string;
  phone: string | null;
  is_member: boolean;
}

export interface BookingRoom {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  price_per_night: number;
}

export interface BookingListItem {
  id: string;
  code: string;
  status: BookingStatus;
  booking_type: BookingType;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  adults: number;
  children: number;
  customer: BookingCustomer;
  room: BookingRoom | null;
  amount: number;
  is_overdue: boolean;
  created_at: string;
}

export interface BookingServiceItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  used_at: string;
  note: string | null;
}

export interface BookingPayment {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  paid_at: string;
  received_by: string | null;
}

export interface BookingInvoice {
  id: string;
  status: InvoiceStatus;
  total_amount: number;
  discount: number;
  final_amount: number;
  paid_amount: number;
  payments: BookingPayment[];
}

export type TimelineEvent =
  | "created"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "rejected"
  | "cancelled"
  | "no_show";

export interface BookingTimelineItem {
  event: TimelineEvent;
  at: string;
  by: string | null;
  reason?: string;
}

export interface BookingDetail extends BookingListItem {
  note: string | null;
  customer_has_id_card: boolean;
  room_total: number;
  service_total: number;
  services: BookingServiceItem[];
  invoice: BookingInvoice | null;
  timeline: BookingTimelineItem[];
  allowed_actions: BookingAction[];
  points_earned: number;
  updated_at: string;
}

export interface BookingStats {
  pending: number;
  arrivals: number;
  arrivals_overdue: number;
  in_house: number;
  departures: number;
  departures_overdue: number;
  upcoming: number;
  occupancy_rate: number;
}

export interface BookingQuote {
  room: BookingRoom;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  price_per_night: number;
  room_total: number;
  available: boolean;
}

/** 1 phòng trong kết quả GET /rooms/available (chỉ các field màn đặt phòng cần) */
export interface AvailableRoom {
  id: string;
  room_number: string;
  floor: number;
  status: "available" | "occupied" | "cleaning" | "maintenance" | "inactive";
  room_type: {
    id: string;
    name: string;
    base_price: number;
    capacity: number;
    bed_type: string;
  };
}

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

/* ============================ Dữ liệu FE gửi lên ============================ */

export interface BookingFilters {
  page: number;
  limit: number;
  tab: BookingTab;
  search: string;
  booking_type: BookingType | "";
  from: string; // '' = không lọc
  to: string;
  sort: BookingSort | ""; // '' = thứ tự mặc định của tab
  order: "asc" | "desc" | "";
}

export interface CreateBookingInput {
  customer_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  note?: string;
  check_in_now?: boolean;
  id_type?: IdType;
  id_card?: string;
}

export interface CheckInInput {
  id_type?: IdType;
  id_card?: string;
}

export interface CheckOutInput {
  payment_method: PaymentMethod;
  reference_number?: string;
  note?: string;
}

/* ============================ Nhãn hiển thị ============================ */

export const TAB_LABELS: Record<BookingTab, string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  arrivals: "Đến",
  in_house: "Đang ở",
  departures: "Đi",
  upcoming: "Sắp tới",
  history: "Lịch sử",
};

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  online: "Online",
  walk_in: "Tại quầy",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  e_wallet: "Ví điện tử",
  credit_card: "Thẻ",
};

export const TIMELINE_LABELS: Record<TimelineEvent, string> = {
  created: "Tạo đặt phòng",
  confirmed: "Xác nhận",
  checked_in: "Nhận phòng",
  checked_out: "Trả phòng",
  rejected: "Từ chối",
  cancelled: "Huỷ",
  no_show: "Không đến",
};

/** Thứ tự sắp xếp gộp sort + order thành 1 ô chọn. '' = mặc định theo tab */
export const BOOKING_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Mặc định" },
  { value: "check_in_date:asc", label: "Ngày đến sớm nhất" },
  { value: "check_out_date:asc", label: "Ngày đi sớm nhất" },
  { value: "created_at:desc", label: "Mới tạo gần đây" },
];

export const CHECK_IN_HOUR = "14:00";
export const CHECK_OUT_HOUR = "12:00";
export const POINT_UNIT = 10_000; // 10.000đ = 1 điểm, giống BE
