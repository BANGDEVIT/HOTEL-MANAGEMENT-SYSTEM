/**
 * Kiểu dữ liệu loại phòng — khớp 1-1 với response-room-type.dto.ts ở BE.
 */
export type BedType = "single" | "double" | "twin" | "queen" | "king";

/** Khớp enum Amenity ở BE (create-room-type.dto.ts) */
export type Amenity =
  | "wifi"
  | "tv"
  | "air_conditioning"
  | "minibar"
  | "balcony"
  | "pool"
  | "gym"
  | "breakfast"
  | "parking"
  | "safe"
  | "hair_dryer"
  | "bathtub"
  | "city_view"
  | "kitchen";

export type RoomTypeStatusFilter = "all" | "active" | "inactive";
export type RoomTypeSort =
  | "price_asc"
  | "price_desc"
  | "occupancy"
  | "revenue"
  | "name";

/* ============================ Dữ liệu từ BE ============================ */

export interface RoomCountByStatus {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
  inactive: number;
}

/** 1 loại phòng ở màn quản lý (GET /room-types/manage) */
export interface RoomTypeItem {
  id: string;
  name: string;
  base_price: number;
  capacity: number;
  bed_type: BedType;
  amenities: Amenity[];
  area: number | null; // m²
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  rooms: RoomCountByStatus;
  occupancy_30d: number; // %
  revenue_30d: number; // tiền phòng, không gồm dịch vụ
  upcoming_bookings: number;
  max_upcoming_guests: number; // sức chứa tối thiểu được phép
  can_delete: boolean; // chưa có phòng nào
}

/* ============================ Dữ liệu FE gửi lên ============================ */

export interface RoomTypeInput {
  name: string;
  base_price: number;
  capacity: number;
  bed_type: BedType;
  amenities: Amenity[];
  area: number | null;
  description: string | null;
}

export interface RoomTypeFilters {
  search: string;
  status: RoomTypeStatusFilter;
  sort: RoomTypeSort;
}

/* ============================ Nhãn hiển thị ============================ */

export const BED_TYPE_LABELS: Record<BedType, string> = {
  single: "1 giường đơn",
  double: "1 giường đôi",
  twin: "2 giường đơn",
  queen: "1 giường Queen",
  king: "1 giường King",
};

/** Nhãn ngắn cho nút chọn trong form */
export const BED_TYPE_SHORT: Record<BedType, string> = {
  single: "Đơn",
  double: "Đôi",
  twin: "2 đơn",
  queen: "Queen",
  king: "King",
};

export const BED_TYPES = Object.keys(BED_TYPE_LABELS) as BedType[];

/** Thứ tự hiển thị: tiện nghi trong phòng trước, dịch vụ chung của khách sạn sau */
export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: "Wi-Fi",
  air_conditioning: "Điều hoà",
  tv: "TV",
  hair_dryer: "Máy sấy tóc",
  minibar: "Minibar",
  safe: "Két sắt",
  bathtub: "Bồn tắm",
  balcony: "Ban công",
  city_view: "View thành phố",
  kitchen: "Bếp",
  breakfast: "Ăn sáng",
  pool: "Hồ bơi",
  gym: "Phòng gym",
  parking: "Đỗ xe",
};

export const AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[];

export const ROOM_TYPE_STATUS_TABS: {
  value: RoomTypeStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Đang kinh doanh" },
  { value: "inactive", label: "Ngừng" },
];

export const ROOM_TYPE_SORT_OPTIONS: { value: RoomTypeSort; label: string }[] = [
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "price_desc", label: "Giá cao → thấp" },
  { value: "occupancy", label: "Công suất cao nhất" },
  { value: "revenue", label: "Doanh thu cao nhất" },
  { value: "name", label: "Tên A → Z" },
];
