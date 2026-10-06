import axiosInstance from "./axiosInstance";
import type {
  PaginatedRoomTypes,
  RoomTypeInput,
  RoomTypeItem,
  RoomTypeListQuery,
} from "../types/roomType";

/** Mọi response của BE đều bọc trong { success, statusCode, message, data } */
interface Envelope<T> {
  success: boolean;
  data: T;
}

/**
 * API cho màn quản lý Loại phòng. Thêm / sửa / bật tắt đều trả về BẢN MỚI kèm số liệu
 * -> FE thay đúng thẻ đó, không phải tải lại cả danh sách.
 */
export const roomTypeApi = {
  /**
   * Danh sách công khai, chỉ loại ĐANG kinh doanh, có phân trang.
   * Trang Phòng dùng: ô chọn loại phòng (RoomForm) và bộ lọc (RoomToolbar).
   */
  getAll: async (params: RoomTypeListQuery = {}) => {
    const { data } = await axiosInstance.get<Envelope<PaginatedRoomTypes>>(
      "/room-types",
      { params },
    );
    return data.data;
  },

  /** Mọi loại (kể cả ngừng kinh doanh), không phân trang: khách sạn chỉ vài loại */
  listForManage: async () => {
    const { data } =
      await axiosInstance.get<Envelope<RoomTypeItem[]>>("/room-types/manage");
    return data.data;
  },

  create: async (body: RoomTypeInput) => {
    const { data } = await axiosInstance.post<Envelope<RoomTypeItem>>(
      "/room-types",
      body,
    );
    return data.data;
  },

  update: async (id: string, body: Partial<RoomTypeInput>) => {
    const { data } = await axiosInstance.patch<Envelope<RoomTypeItem>>(
      `/room-types/${id}`,
      body,
    );
    return data.data;
  },

  setActive: async (id: string, isActive: boolean) => {
    const { data } = await axiosInstance.patch<Envelope<RoomTypeItem>>(
      `/room-types/${id}/status`,
      {
        is_active: isActive,
      },
    );
    return data.data;
  },

  remove: async (id: string) => {
    await axiosInstance.delete(`/room-types/${id}`);
  },
};
