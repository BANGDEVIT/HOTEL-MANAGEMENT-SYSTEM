/**
 * Kiểu dữ liệu khách hàng — khớp 1-1 với customer-response.dto.ts ở BE.
 * Ngày giờ đi qua JSON luôn là chuỗi, nên ở FE là string chứ không phải Date.
 */

export type IdType = "cccd" | "passport";
export type CustomerSource = "walk_in" | "online_registration";
export type StayStatus = "in_house" | "arriving" | "none";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";
export type CustomerSort = "created_at" | "name" | "reward_points" | "stays";
export type Membership = "member" | "guest";

/* ============================ Dữ liệu từ BE ============================ */

export interface CustomerListItem {
  id: string;
  first_name: string; // Tên
  last_name: string; // Họ và tên đệm
  full_name: string;
  phone: string | null;
  email: string | null;
  id_type: IdType | null;
  id_card_last4: string | null; // danh sách chỉ có 4 số cuối
  nationality: string | null;
  source: CustomerSource;
  is_member: boolean;
  member_since: string | null;
  account_active: boolean | null; // null = khách vãng lai
  reward_points: number;
  created_at: string;
  stays: number;
  last_stay_at: string | null; // "YYYY-MM-DD"
  stay_status: StayStatus;
  current_rooms: string[];
  next_arrival: string | null; // "YYYY-MM-DD"
}

export interface CustomerDetail extends CustomerListItem {
  id_card: string | null; // số đầy đủ, chỉ có ở API chi tiết
  id_card_img_url: string | null;
  id_card_img_back_url: string | null;
  account: { id: string; email: string; is_active: boolean } | null;
  total_spent: number;
  updated_at: string;
}

export interface CustomerLookup extends CustomerListItem {
  matched_by: ("phone" | "id_card")[];
}

export interface CustomerStats {
  total: number;
  members: number;
  guests: number;
  in_house: number;
  arriving_today: number;
  new_this_month: number;
  new_last_month: number;
  returning_rate: number; // %
}

export interface CustomerBooking {
  id: string;
  status: BookingStatus;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  rooms: { room_number: string; room_type: string }[];
  amount: number;
}

export interface CustomerNote {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; full_name: string };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ============================ Dữ liệu FE gửi lên ============================ */

export interface CustomerFilters {
  page: number;
  limit: number;
  search: string;
  nationality: string; // '' = tất cả
  membership: Membership | "all";
  stay: StayStatus[]; // [] = tất cả
  sort: CustomerSort;
  order: "asc" | "desc";
}

export interface CustomerIdentityInput {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  id_type?: IdType;
  id_card?: string;
  nationality?: string;
}

export interface CustomerUpdateInput extends Partial<CustomerIdentityInput> {
  reward_points?: number; // chỉ quản lý
  is_active?: boolean; // chỉ quản lý, chỉ khách có tài khoản
}

export interface IdImages {
  front?: File | null;
  back?: File | null;
}

/* ============================ Nhãn hiển thị ============================ */

export const STAY_LABELS: Record<StayStatus, string> = {
  in_house: "Đang ở",
  arriving: "Sắp đến",
  none: "Không lưu trú",
};

export const ID_TYPE_LABELS: Record<IdType, string> = {
  cccd: "CCCD",
  passport: "Hộ chiếu",
};

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  walk_in: "Tạo tại quầy",
  online_registration: "Tự đăng ký online",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  checked_in: "Đang ở",
  checked_out: "Đã trả phòng",
  cancelled: "Đã huỷ",
  no_show: "Không check-in",
};

/** Mỗi lựa chọn sắp xếp = 1 cặp sort + order, gộp lại cho 1 ô chọn */
export const SORT_OPTIONS: {
  value: `${CustomerSort}:${"asc" | "desc"}`;
  label: string;
}[] = [
  { value: "created_at:desc", label: "Mới tạo gần đây" },
  { value: "stays:desc", label: "Ở nhiều lần nhất" },
  { value: "reward_points:desc", label: "Điểm thưởng cao nhất" },
  { value: "name:asc", label: "Tên A → Z" },
];

/** Gợi ý quốc tịch. BE nhận chuỗi tự do, danh sách này chỉ để chọn nhanh */
export const NATIONALITIES = [
  "Việt Nam",
  "Hàn Quốc",
  "Nhật Bản",
  "Trung Quốc",
  "Hoa Kỳ",
  "Anh",
  "Pháp",
  "Đức",
  "Úc",
  "Thái Lan",
  "Singapore",
];

/** Khách ở từ 3 lần trở lên được gắn nhãn "Khách quen" */
export const REGULAR_MIN_STAYS = 3;
