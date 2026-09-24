import { roomTypeApi } from "@/api/roomTypeApi";
import type {
  CreateRoomTypePayload,
  RoomType,
  RoomTypeFilters,
  UpdateRoomTypePayload,
} from "@/types/roomType";
import { toast } from "sonner";
import { create } from "zustand";
import type { RoomTypeStats } from "../components/OccupancyBar";
import { roomApi } from "@/api/roomApi";

interface RoomTypeState {
  roomTypes: RoomType[];
  total: number;
  totalPages: number;
  loading: boolean;
  filters: RoomTypeFilters;

  setFilters: (f: Partial<RoomTypeFilters>) => void;
  fetchRoomTypes: () => Promise<void>;
  createRoomType: (payload: CreateRoomTypePayload) => Promise<void>;
  updateRoomType: (id: string, payload: UpdateRoomTypePayload) => Promise<void>;
  deleteRoomType: (id: string) => Promise<void>;
  roomStats: Record<string, RoomTypeStats>;
  fetchRoomStats: () => Promise<void>;
}

const showError = (e: any, fallback: string) => {
  toast.error(fallback ?? e?.reponse?.data?.message ?? fallback);
};

let requiredId = 0;

export const useRoomTypeStore = create<RoomTypeState>((set, get) => ({
  roomTypes: [],
  total: 0,
  totalPages: 1,
  loading: false,
  filters: { search: "", page: 1, limit: 10 },
  roomStats: {},

  setFilters: (f) => {
    set((s) => ({ filters: { ...s.filters, ...f, page: f.page ?? 1 } }));
    get().fetchRoomTypes(); // không dùng await vì không cần chờ nó hoàn thành khi nào cho nó chạy ngầm
  },

  fetchRoomTypes: async () => {
    const current = ++requiredId;
    set({ loading: true });
    try {
      const res = await roomTypeApi.getAll(get().filters);
      if (current !== requiredId) return;
      set({ roomTypes: res.data, total: res.total, totalPages: res.totalPages });
    } catch (e: any) {
      if (current !== requiredId) {
        return;
      }
      showError(e, "Không tải được danh sách phòng");
    } finally {
      if (current === requiredId) {
        set({ loading: false });
      }
    }
  },

  createRoomType: async (payload: CreateRoomTypePayload) => {
    try {
      await roomTypeApi.create(payload);
      set({ loading: false });
      await get().fetchRoomTypes();
    } catch (e: any) {
      showError(e, "Không tạo được loại phòng");
    }
  },

  updateRoomType: async (id: string, payload: UpdateRoomTypePayload) => {
    try {
      await roomTypeApi.update(id, payload);
      set({ loading: false });
      await get().fetchRoomTypes();
    } catch (e: any) {
      showError(e, "Không cập nhật được loài phông");
    }
  },

  deleteRoomType: async (id: string) => {
    try {
      await roomTypeApi.remove(id);
      set({ loading: false });
      await get().fetchRoomTypes();
    } catch (e: any) {
      showError(e, "Không thể xóa loại phòng");
    }
  },

  // Đếm phòng theo loại ở FE — đủ dùng khi khách sạn vài chục đến vài trăm phòng.
  // Nhiều hơn thế nên chuyển sang để BE đếm sẵn.
  fetchRoomStats: async () => {
    try {
      const res = await roomApi.getAll({ page: 1, limit: 500 });
      const stats: Record<string, RoomTypeStats> = {};

      for (const room of res.data) {
        const s = (stats[room.room_type.id] ??= {
          total: 0,
          available: 0,
          occupied: 0,
          cleaning: 0,
          maintenance: 0,
        });
        s.total += 1;
        if (room.status in s) s[room.status as keyof RoomTypeStats] += 1;
      }

      set({ roomStats: stats });
    } catch {
      // Thống kê là thông tin phụ — lỗi thì bỏ qua, không làm phiền bằng toast
    }
  },
}));
