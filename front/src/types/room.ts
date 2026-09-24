export type RoomStatus =
  | "available"
  | "occupied"
  | "maintenance"
  | "cleaning"
  | "inactive";
export type BedType = "single" | "double" | "twin" | "king" | "queen";
export type SortField = "room_number" | "floor" | "status" | "created_at";
export type SortOrder = "asc" | "desc";

export interface RoomTypeInRoom {
  id: string;
  name: string;
  base_price: number;
  capacity: number;
  bed_type: BedType;
  amenities: string[];
}

export interface Room {
  id: string;
  room_number: string;
  floor: number;
  status: RoomStatus;
  images: string[];
  room_type: RoomTypeInRoom;
  created_at: string;
  updated_at: string;
}

export interface RoomListResponse {
  data: Room[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AvailableRoomResponse extends RoomListResponse {
  search_info: {
    check_in_date: string;
    check_out_date: string;
    nights: number;
  };
}

export interface RoomFilters {
  search: string;
  status: RoomStatus | "";
  room_type_id: string;
  floor: string;
  sortBy: SortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface AvailabilityQuery {
  check_in_date: string;
  check_out_date: string;
  room_type_id?: string;
  capacity?: number;
}

export interface CreateRoomPayload {
  room_number: string;
  room_type_id: string;
  floor: number;
}

export interface UpdateRoomPayload {
  room_type_id?: string;
  floor?: number;
}

export interface UpdateRoomStatusPayload {
  status: RoomStatus;
}

// {
//   available: number;
//   occupied: number;
//   maintenance: number;
//   total: number;
// }
// & intersection type (kiểu giao)
export type RoomStats = Record<RoomStatus, number> & { total: number };

/** Sao chép luật chuyển trạng thái từ RoomService ở BE.
 *  Dùng để chỉ hiện lựa chọn hợp lệ — BE vẫn tự kiểm tra lại. */
export const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ["cleaning", "maintenance"],
  cleaning: ["available"],
  maintenance: ["available"],
  occupied: ["cleaning"],
  inactive: [],
};

export const STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Trống",
  occupied: "Có khách",
  cleaning: "Đang dọn",
  maintenance: "Bảo trì",
  inactive: "Đã ẩn",
};

/** Màu đặc cho thanh trạng thái bên trái mỗi hàng — không dùng gradient */
export const STATUS_COLOR: Record<RoomStatus, string> = {
  available: "#0E7C5A",
  occupied: "#B4321F",
  cleaning: "#C77D10",
  maintenance: "#6B7684",
  inactive: "#98A1AC",
};

export const BED_TYPE_LABELS: Record<BedType, string> = {
  single: "Giường đơn",
  double: "Giường đôi",
  twin: "2 giường đơn",
  king: "Giường King",
  queen: "Giường Queen",
};

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "room_number", label: "Số phòng" },
  { value: "floor", label: "Tầng" },
  { value: "status", label: "Trạng thái" },
  { value: "created_at", label: "Ngày tạo" },
];
