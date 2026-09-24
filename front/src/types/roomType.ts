import type { BedType } from "./room";

export type Amenity =
  | "wifi"
  | "tv"
  | "air_conditioning"
  | "minibar"
  | "bathtub"
  | "balcony"
  | "pool"
  | "gym"
  | "breakfast"
  | "parking"
  | "safe"
  | "hair_dryer";

export interface RoomType {
  id: string;
  name: string;
  base_price: number;
  capacity: number;
  bed_type: BedType;
  amenities: Amenity[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomTypeListResponse {
  data: RoomType[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RoomTypeFilters {
  search: string;
  page: number;
  limit: number;
}

export interface CreateRoomTypePayload {
  name: string;
  base_price: number;
  capacity: number;
  bed_type: BedType;
  amenities?: Amenity[];
}

export type UpdateRoomTypePayload = Partial<CreateRoomTypePayload>;

export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: "WiFi",
  tv: "TV",
  air_conditioning: "Điều hoà",
  minibar: "Minibar",
  bathtub: "Bồn tắm",
  balcony: "Ban công",
  pool: "Hồ bơi",
  gym: "Phòng gym",
  breakfast: "Bữa sáng",
  parking: "Chỗ đỗ xe",
  safe: "Két an toàn",
  hair_dryer: "Máy sấy tóc",
};

/** Nhóm tiện nghi để form dễ đọc hơn danh sách phẳng 12 mục */
export const AMENITY_GROUPS: { title: string; items: Amenity[] }[] = [
  {
    title: "Trong phòng",
    items: ["wifi", "tv", "air_conditioning", "minibar", "safe", "hair_dryer"],
  },
  { title: "Không gian", items: ["bathtub", "balcony"] },
  { title: "Tiện ích chung", items: ["pool", "gym", "breakfast", "parking"] },
];

export const ALL_AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[];

/** Thứ tự hiển thị ở danh sách: tiện nghi phân biệt hạng phòng lên trước,
 *  tiện nghi hạng nào cũng có (WiFi, TV, điều hoà) xuống sau */
export const AMENITY_PRIORITY: Amenity[] = [
  "bathtub",
  "balcony",
  "minibar",
  "pool",
  "breakfast",
  "gym",
  "safe",
  "hair_dryer",
  "parking",
  "air_conditioning",
  "tv",
  "wifi",
];

export const sortAmenities = (list: Amenity[]) =>
  [...list].sort(
    (a, b) => AMENITY_PRIORITY.indexOf(a) - AMENITY_PRIORITY.indexOf(b),
  );
