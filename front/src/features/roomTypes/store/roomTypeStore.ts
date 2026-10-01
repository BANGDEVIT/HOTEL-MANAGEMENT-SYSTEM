import { create } from "zustand";
import { toast } from "sonner";
import { roomTypeApi } from "../../../api/roomTypeApi";
import type { RoomTypeFilters, RoomTypeItem } from "../../../types/roomType";
import { errorMessage } from "../../../utils/errorMessage";

/**
 * Khách sạn chỉ vài loại phòng -> tải HẾT 1 lần, tìm / lọc / sắp xếp ngay trên FE
 * (xem visibleRoomTypes trong utils). Không gọi lại API mỗi lần gõ tìm kiếm.
 */

export const DEFAULT_FILTERS: RoomTypeFilters = {
  search: "",
  status: "all",
  sort: "price_asc",
};

interface RoomTypeState {
  items: RoomTypeItem[];
  filters: RoomTypeFilters;
  loading: boolean;
  lastUpdated: Date | null;

  fetch: () => Promise<void>;
  setFilters: (patch: Partial<RoomTypeFilters>) => void;
  resetFilters: () => void;
  /** Thêm mới hoặc thay đúng 1 loại bằng bản BE trả về */
  upsert: (item: RoomTypeItem) => void;
  remove: (id: string) => void;
}

export const useRoomTypeStore = create<RoomTypeState>((set) => ({
  items: [],
  filters: DEFAULT_FILTERS,
  loading: false,
  lastUpdated: null,

  fetch: async () => {
    set({ loading: true });
    try {
      set({ items: await roomTypeApi.listForManage(), lastUpdated: new Date() });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được loại phòng"));
    } finally {
      set({ loading: false });
    }
  },

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  upsert: (item) =>
    set((s) => ({
      items: s.items.some((x) => x.id === item.id)
        ? s.items.map((x) => (x.id === item.id ? item : x))
        : [...s.items, item],
    })),

  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));
