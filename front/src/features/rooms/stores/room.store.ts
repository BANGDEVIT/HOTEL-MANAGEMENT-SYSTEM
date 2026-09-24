import { roomApi } from "@/api/roomApi";
import type {
  CreateRoomPayload,
  Room,
  RoomFilters,
  RoomStats,
  UpdateRoomPayload,
  UpdateRoomStatusPayload,
} from "@/types/room";
import { toast } from "sonner";
import { create } from "zustand";

interface RoomState {
  rooms: Room[];
  total: number;
  totalPages: number;
  loading: boolean;
  filters: RoomFilters;
  lastUpdated: Date | null;
  stats: RoomStats | null;

  setFilters: (f: Partial<RoomFilters>) => void;
  toggleSort: (filed: RoomFilters["sortBy"]) => void;
  fetchRooms: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createRoom: (payload: CreateRoomPayload) => Promise<void>;
  updateRoom: (id: string, payload: UpdateRoomPayload) => Promise<void>;
  updateRoomStatus: (id: string, payload: UpdateRoomStatusPayload) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  addRoomImages: (id: string, files: File[]) => Promise<void>;
  updateRoomImages: (id: string, images: string[]) => Promise<void>;
}

const showError = (e: any, fallback: string) => {
  const msg = e?.response?.data?.message;
  toast.error(Array.isArray(msg) ? msg[0] : (fallback ?? msg));
};

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  total: 0,
  totalPages: 1,
  loading: false,
  lastUpdated: null,
  stats: null,
  filters: {
    search: "",
    status: "",
    room_type_id: "",
    floor: "",
    sortBy: "room_number",
    order: "asc",
    page: 1,
    limit: 50, // lấy nhiều để nhóm theo tầng có nghĩa, không cắt vụn giữa tầng
  },

  setFilters: (f: Partial<RoomFilters>) => {
    set((s) => ({ filters: { ...s.filters, ...f, page: f.page ?? 1 } }));
    get().fetchRooms();
  },

  toggleSort: (field: RoomFilters["sortBy"]) => {
    const { filters } = get();
    const nextOrder =
      filters.sortBy === field && filters.order === "asc" ? "desc" : "asc";
    set({ filters: { ...filters, sortBy: field, order: nextOrder, page: 1 } });
    get().fetchRooms();
  },

  fetchRooms: async () => {
    set({ loading: true });
    try {
      const res = await roomApi.getAll(get().filters);
      set({
        rooms: res.data,
        total: res.total,
        totalPages: res.totalPages,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (e: any) {
      showError(e, "Không tải được danh sách");
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      set({ loading: true });
      set({ stats: await roomApi.getStats() });
    } catch {
      // Đây là số phụ: lỗi thì giữ số cũ và KHÔNG toast.
      // Nếu mạng hỏng thì fetchRooms đã toast rồi, toast thêm chỉ thành 2 thông báo.
    } finally {
      set({ loading: false });
    }
  },

  createRoom: async (payload: CreateRoomPayload) => {
    try {
      await roomApi.create(payload);
      await get().fetchRooms();
      await get().fetchStats();
    } catch (e: any) {
      showError("Không tạo được phòng", e);
      throw e; // ném lại để component biết mà KHÔNG đóng form
    }
  },

  updateRoom: async (id: string, payload: UpdateRoomPayload) => {
    try {
      await roomApi.update(id, payload);
      await get().fetchRooms();
      await get().fetchStats();
    } catch (e: any) {
      showError("Không lưu được thay đổi", e);
      throw e;
    }
  },

  updateRoomStatus: async (id: string, payload: UpdateRoomStatusPayload) => {
    try {
      await roomApi.updateStatus(id, payload);
      await get().fetchRooms();
      await get().fetchStats();
    } catch (e: any) {
      showError("Không đổi được trạng thái phòng", e);
      throw e;
    }
  },

  deleteRoom: async (id: string) => {
    try {
      await roomApi.remove(id);
      await get().fetchRooms();
      await get().fetchRooms();
    } catch (e: any) {
      showError("Không ẩn được phòng", e);
      throw e;
    }
  },

  // Thay đúng phòng đó trong danh sách, không tải lại cả trang —
  // dialog đang mở cần thấy ảnh mới ngay
  addRoomImages: async (id: string, files: File[]) => {
    try {
      const room = await roomApi.addImages(id, files);
      set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? room : r)) }));
    } catch (e) {
      showError(e, "Không tải được ảnh lên");
      throw e;
    }
  },

  updateRoomImages: async (id: string, images: string[]) => {
    try {
      const room = await roomApi.updateImages(id, images);
      set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? room : r)) }));
    } catch (e) {
      showError(e, "Không lưu được thay đổi ảnh");
      throw e;
    }
  },
}));
