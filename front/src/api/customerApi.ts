import axiosInstance from "./axiosInstance";
import type {
  CustomerBooking,
  CustomerDetail,
  CustomerFilters,
  CustomerIdentityInput,
  CustomerListItem,
  CustomerLookup,
  CustomerNote,
  CustomerStats,
  CustomerUpdateInput,
  IdImages,
  Paginated,
} from "../types/customer";

/** Mọi response của BE đều bọc trong { success, statusCode, message, data } */
interface Envelope<T> {
  success: boolean;
  data: T;
}

/**
 * Đổi bộ lọc của FE sang query string BE hiểu.
 * Giá trị rỗng / "tất cả" thì BỎ HẲN, không gửi chuỗi rỗng (BE sẽ báo lỗi validate).
 */
function toQuery(f: CustomerFilters) {
  return {
    page: f.page,
    limit: f.limit,
    sort: f.sort,
    order: f.order,
    search: f.search.trim() || undefined,
    nationality: f.nationality || undefined,
    membership: f.membership === "all" ? undefined : f.membership,
    stay: f.stay.length ? f.stay.join(",") : undefined, // BE nhận "in_house,arriving"
  };
}

/**
 * Tạo FormData cho tạo / sửa khách (có ảnh giấy tờ nên phải gửi multipart).
 * - Bỏ qua field undefined / chuỗi rỗng.
 * - multipart chỉ gửi được chuỗi -> số và boolean đổi sang chuỗi, BE tự đổi lại.
 * - KHÔNG tự đặt header Content-Type: trình duyệt tự thêm boundary.
 */
function toFormData(
  values: CustomerUpdateInput & { allow_duplicate_phone?: boolean },
  images?: IdImages,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    form.append(key, String(value));
  }
  if (images?.front) form.append("front_image", images.front);
  if (images?.back) form.append("back_image", images.back);
  return form;
}

export const customerApi = {
  list: async (filters: CustomerFilters) => {
    const { data } = await axiosInstance.get<Envelope<Paginated<CustomerListItem>>>(
      "/customers",
      {
        params: toQuery(filters),
      },
    );
    return data.data;
  },

  stats: async () => {
    const { data } =
      await axiosInstance.get<Envelope<CustomerStats>>("/customers/stats");
    return data.data;
  },

  detail: async (id: string) => {
    const { data } = await axiosInstance.get<Envelope<CustomerDetail>>(
      `/customers/${id}`,
    );
    return data.data;
  },

  bookings: async (id: string) => {
    const { data } = await axiosInstance.get<Envelope<CustomerBooking[]>>(
      `/customers/${id}/bookings`,
    );
    return data.data;
  },

  notes: async (id: string) => {
    const { data } = await axiosInstance.get<Envelope<CustomerNote[]>>(
      `/customers/${id}/notes`,
    );
    return data.data;
  },

  addNote: async (id: string, content: string) => {
    const { data } = await axiosInstance.post<Envelope<CustomerNote>>(
      `/customers/${id}/notes`,
      {
        content,
      },
    );
    return data.data;
  },

  /** BE trả 204 No Content -> không có data */
  deleteNote: async (id: string, noteId: string) => {
    await axiosInstance.delete(`/customers/${id}/notes/${noteId}`);
  },

  /** Kiểm tra SĐT / số giấy tờ đã có hồ sơ chưa. exclude_id: bỏ qua chính khách đang sửa */
  lookup: async (params: {
    phone?: string;
    id_card?: string;
    exclude_id?: string;
  }) => {
    const { data } = await axiosInstance.get<Envelope<CustomerLookup[]>>(
      "/customers/lookup",
      {
        params,
      },
    );
    return data.data;
  },

  createGuest: async (
    values: CustomerIdentityInput & { allow_duplicate_phone?: boolean },
    images?: IdImages,
  ) => {
    const { data } = await axiosInstance.post<Envelope<CustomerDetail>>(
      "/customers/guest",
      toFormData(values, images),
    );
    return data.data;
  },

  update: async (id: string, values: CustomerUpdateInput, images?: IdImages) => {
    const { data } = await axiosInstance.patch<Envelope<CustomerDetail>>(
      `/customers/${id}`,
      toFormData(values, images),
    );
    return data.data;
  },

  /** Tạo tài khoản thành viên cho khách vãng lai */
  linkAccount: async (id: string, body: { email: string; password: string }) => {
    const { data } = await axiosInstance.post<Envelope<{ message: string }>>(
      `/customers/${id}/link-account`,
      body,
    );
    return data.data;
  },
};
