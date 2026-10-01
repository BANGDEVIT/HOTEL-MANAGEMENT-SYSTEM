/**
 * Hàm thuần + màu cho màn Loại phòng.
 * File .ts (không có JSX) -> tách khỏi component, Fast Refresh vẫn chạy tốt.
 */
import type {
  RoomCountByStatus,
  RoomTypeFilters,
  RoomTypeItem,
} from "../../../types/roomType";

export {
  formatMoney,
  formatMoneyShort,
  formatNumber,
} from "../../customer/utils/format";

const money = new Intl.NumberFormat("vi-VN");

/** 800000 -> "800.000" */
export const formatAmount = (n: number) => money.format(n);

/** "1.250.000" người dùng gõ -> 1250000. Rỗng -> NaN */
export const parseDigits = (s: string) =>
  s.replace(/\D/g, "") === "" ? NaN : Number(s.replace(/\D/g, ""));

/**
 * Màu trạng thái phòng: GIỐNG trang Phòng (DESIGN.md mục 2.4) để người dùng không phải học lại.
 * Lấy từ biến CSS, không chép hex vào .ts.
 */
export const ROOM_STATUS_META: {
  key: Exclude<keyof RoomCountByStatus, "total">;
  label: string;
  color: string;
}[] = [
  { key: "available", label: "Trống", color: "var(--color-room-available)" },
  { key: "occupied", label: "Có khách", color: "var(--color-room-occupied)" },
  { key: "cleaning", label: "Đang dọn", color: "var(--color-room-cleaning)" },
  { key: "maintenance", label: "Bảo trì", color: "var(--color-room-maintenance)" },
  { key: "inactive", label: "Ngừng", color: "var(--color-room-inactive)" },
];

/** So tên không phân biệt hoa thường, bỏ dấu tiếng Việt: gõ "gia dinh" vẫn ra "Gia đình" */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/**
 * Lọc + sắp xếp trên FE. Loại ngừng kinh doanh luôn xếp CUỐI (ít khi cần đụng tới).
 * Gọi trong useMemo của component: hàm trả mảng mới, không dùng làm selector Zustand.
 */
export function visibleRoomTypes(
  items: RoomTypeItem[],
  f: RoomTypeFilters,
): RoomTypeItem[] {
  const q = fold(f.search);
  const list = items.filter(
    (t) =>
      (f.status === "all" || (f.status === "active") === t.is_active) &&
      (!q || fold(t.name).includes(q)),
  );

  const by: Record<
    RoomTypeFilters["sort"],
    (a: RoomTypeItem, b: RoomTypeItem) => number
  > = {
    price_asc: (a, b) => a.base_price - b.base_price,
    price_desc: (a, b) => b.base_price - a.base_price,
    occupancy: (a, b) => b.occupancy_30d - a.occupancy_30d,
    revenue: (a, b) => b.revenue_30d - a.revenue_30d,
    name: (a, b) => a.name.localeCompare(b.name, "vi"),
  };

  return list.sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      by[f.sort](a, b) ||
      a.name.localeCompare(b.name, "vi"),
  );
}

/** Số liệu 4 ô đầu trang, tính từ danh sách (không cần API riêng) */
export function summarize(items: RoomTypeItem[]) {
  const active = items.filter((t) => t.is_active);
  const rooms = items.reduce(
    (acc, t) => {
      acc.total += t.rooms.total;
      acc.available += t.rooms.available;
      acc.occupied += t.rooms.occupied;
      acc.off += t.rooms.maintenance + t.rooms.inactive;
      return acc;
    },
    { total: 0, available: 0, occupied: 0, off: 0 },
  );
  const prices = active.map((t) => t.base_price);
  const revenue = items.reduce((s, t) => s + t.revenue_30d, 0);
  const top = items.reduce<RoomTypeItem | null>(
    (best, t) => (!best || t.revenue_30d > best.revenue_30d ? t : best),
    null,
  );

  return {
    total: items.length,
    active: active.length,
    rooms,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    avgPrice: prices.length
      ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
      : 0,
    revenue,
    top: top && top.revenue_30d > 0 ? top : null,
  };
}
