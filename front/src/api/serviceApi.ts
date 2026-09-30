import axiosInstance from "./axiosInstance";
import type {
  Paginated,
  ServiceFilters,
  ServiceInput,
  ServiceItem,
  ServiceStats,
} from "../types/service";

/** Mọi response của BE đều bọc trong { success, statusCode, message, data } */
interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Giá trị rỗng / "tất cả" thì BỎ HẲN khỏi query, không gửi chuỗi rỗng (BE báo lỗi validate) */
function toQuery(f: ServiceFilters) {
  return {
    page: f.page,
    limit: f.limit,
    search: f.search.trim() || undefined,
    category: f.category || undefined,
    status: f.status === "all" ? undefined : f.status,
    sort: f.sort,
    order: f.order || undefined,
  };
}

export const serviceApi = {
  list: async (filters: ServiceFilters) => {
    const { data } = await axiosInstance.get<Envelope<Paginated<ServiceItem>>>(
      "/services",
      {
        params: toQuery(filters),
      },
    );
    return data.data;
  },

  /** Dịch vụ đang bán, cho hộp thoại "Thêm dịch vụ" của màn Đặt phòng */
  listActive: async () => {
    const { data } = await axiosInstance.get<Envelope<Paginated<ServiceItem>>>(
      "/services",
      {
        params: { status: "active", sort: "usage", limit: 100 },
      },
    );
    return data.data.data;
  },

  stats: async () => {
    const { data } =
      await axiosInstance.get<Envelope<ServiceStats>>("/services/stats");
    return data.data;
  },

  create: async (body: ServiceInput) => {
    const { data } = await axiosInstance.post<Envelope<ServiceItem>>(
      "/services",
      body,
    );
    return data.data;
  },

  update: async (id: string, body: Partial<ServiceInput>) => {
    const { data } = await axiosInstance.patch<Envelope<ServiceItem>>(
      `/services/${id}`,
      body,
    );
    return data.data;
  },

  setActive: async (id: string, isActive: boolean) => {
    const { data } = await axiosInstance.patch<Envelope<ServiceItem>>(
      `/services/${id}/status`,
      {
        is_active: isActive,
      },
    );
    return data.data;
  },

  /** BE trả 204 No Content. Dịch vụ đã từng dùng -> 409 */
  remove: async (id: string) => {
    await axiosInstance.delete(`/services/${id}`);
  },
};
