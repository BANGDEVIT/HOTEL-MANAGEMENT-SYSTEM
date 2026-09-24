import axiosInstance from "./axiosInstance";

import type {
  CreateRoomTypePayload,
  RoomType,
  RoomTypeFilters,
  RoomTypeListResponse,
  UpdateRoomTypePayload,
} from "../types/roomType";
import type { ApiResponse } from "./api";

export const roomTypeApi = {
  getAll: async (
    filters: Partial<RoomTypeFilters>,
  ): Promise<RoomTypeListResponse> => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));

    const { data } = await axiosInstance.get<ApiResponse<RoomTypeListResponse>>(
      `/room-types?${params}`,
    );
    return data.data;
  },

  getOne: async (id: string): Promise<RoomType> => {
    const { data } = await axiosInstance.get<ApiResponse<RoomType>>(
      `/room-types/${id}`,
    );
    return data.data;
  },

  create: async (payload: CreateRoomTypePayload): Promise<RoomType> => {
    const { data } = await axiosInstance.post<ApiResponse<RoomType>>(
      "/room-types",
      payload,
    );
    return data.data;
  },

  update: async (id: string, payload: UpdateRoomTypePayload): Promise<RoomType> => {
    const { data } = await axiosInstance.patch<ApiResponse<RoomType>>(
      `/room-types/${id}`,
      payload,
    );
    return data.data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/room-types/${id}`);
  },
};
