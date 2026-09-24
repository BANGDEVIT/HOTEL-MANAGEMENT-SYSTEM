import type {
  AvailabilityQuery,
  AvailableRoomResponse,
  CreateRoomPayload,
  Room,
  RoomFilters,
  RoomListResponse,
  RoomStats,
  UpdateRoomPayload,
  UpdateRoomStatusPayload,
} from "@/types/room";
import axiosInstance from "./axiosInstance";
import type { ApiResponse } from "./api";

export const roomApi = {
  getAll: async (filters: Partial<RoomFilters>): Promise<RoomListResponse> => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.room_type_id) params.set("room_type_id", filters.room_type_id);
    if (filters.floor) params.set("floor", filters.floor);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.order) params.set("order", filters.order);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));

    const { data } = await axiosInstance.get<ApiResponse<RoomListResponse>>(
      `/rooms?${params}`,
    );
    return data.data;
  },

  /** Tìm phòng còn trống trong khoảng ngày — endpoint public ở BE */
  getAvailable: async (query: AvailabilityQuery): Promise<AvailableRoomResponse> => {
    const params = new URLSearchParams();
    params.set("check_in_date", query.check_in_date);
    params.set("check_out_date", query.check_out_date);
    if (query.room_type_id) params.set("room_type_id", query.room_type_id);
    if (query.capacity) params.set("capacity", String(query.capacity));
    params.set("limit", "50");

    const { data } = await axiosInstance.get<ApiResponse<AvailableRoomResponse>>(
      `/rooms/available?${params}`,
    );
    return data.data;
  },

  getOne: async (id: string): Promise<Room> => {
    const { data } = await axiosInstance.get<ApiResponse<Room>>(`/rooms/${id}`);
    return data.data;
  },

  getStats: async (): Promise<RoomStats> => {
    const { data } = await axiosInstance.get<ApiResponse<RoomStats>>("/rooms/stats");
    return data.data;
  },

  create: async (payload: CreateRoomPayload): Promise<Room> => {
    const { data } = await axiosInstance.post<ApiResponse<Room>>("/rooms", payload);
    return data.data;
  },

  addImages: async (id: string, files: File[]): Promise<Room> => {
    const form = new FormData();
    // Cùng một key "files" lặp lại — khớp FilesInterceptor('files') ở BE
    files.map((file) => form.append("files", file));
    const { data } = await axiosInstance.post<ApiResponse<Room>>(
      `/rooms/${id}/images`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return data.data;
  },

  updateImages: async (id: string, images: string[]): Promise<Room> => {
    const { data } = await axiosInstance.patch<ApiResponse<Room>>(
      `/rooms/${id}/images`,
      images,
    );
    return data.data;
  },

  update: async (id: string, payload: UpdateRoomPayload): Promise<Room> => {
    const { data } = await axiosInstance.patch<ApiResponse<Room>>(
      `/rooms/${id}`,
      payload,
    );
    return data.data;
  },

  updateStatus: async (
    id: string,
    payload: UpdateRoomStatusPayload,
  ): Promise<Room> => {
    const { data } = await axiosInstance.patch<ApiResponse<Room>>(
      `/rooms/${id}/status`,
      payload,
    );
    return data.data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/rooms/${id}`);
  },
};
