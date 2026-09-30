import axiosInstance from "./axiosInstance";
import { serviceApi } from "./serviceApi";
import type { Paginated } from "../types/customer";
import type {
  AvailableRoom,
  BookingDetail,
  BookingFilters,
  BookingListItem,
  BookingQuote,
  BookingStats,
  CheckInInput,
  CheckOutInput,
  CreateBookingInput,
  ServiceOption,
} from "../types/booking";

/** Mọi response của BE đều bọc trong { success, statusCode, message, data } */
interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Giá trị rỗng thì BỎ HẲN khỏi query, không gửi chuỗi rỗng (BE báo lỗi validate) */
function toQuery(f: BookingFilters) {
  return {
    page: f.page,
    limit: f.limit,
    tab: f.tab,
    search: f.search.trim() || undefined,
    booking_type: f.booking_type || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    sort: f.sort || undefined,
    order: f.order || undefined,
  };
}

/**
 * Mọi API thao tác (duyệt, nhận phòng, trả phòng...) đều trả về CHI TIẾT MỚI NHẤT
 * -> drawer thay luôn dữ liệu, không phải gọi lại GET /bookings/:id.
 */
const action = async (
  method: "patch" | "post" | "delete",
  url: string,
  body?: object,
) => {
  const { data } = await axiosInstance.request<Envelope<BookingDetail>>({
    method,
    url,
    data: body,
  });
  return data.data;
};

export const bookingApi = {
  list: async (filters: BookingFilters) => {
    const { data } = await axiosInstance.get<Envelope<Paginated<BookingListItem>>>(
      "/bookings",
      {
        params: toQuery(filters),
      },
    );
    return data.data;
  },

  stats: async () => {
    const { data } =
      await axiosInstance.get<Envelope<BookingStats>>("/bookings/stats");
    return data.data;
  },

  detail: async (id: string) => {
    const { data } = await axiosInstance.get<Envelope<BookingDetail>>(
      `/bookings/${id}`,
    );
    return data.data;
  },

  quote: async (params: {
    room_id: string;
    check_in_date: string;
    check_out_date: string;
    adults: number;
    children: number;
  }) => {
    const { data } = await axiosInstance.get<Envelope<BookingQuote>>(
      "/bookings/quote",
      { params },
    );
    return data.data;
  },

  create: async (body: CreateBookingInput) => {
    const { data } = await axiosInstance.post<Envelope<BookingDetail>>(
      "/bookings",
      body,
    );
    return data.data;
  },

  /* ----- Thao tác ----- */
  confirm: (id: string) => action("patch", `/bookings/${id}/confirm`),
  reject: (id: string, reason: string) =>
    action("patch", `/bookings/${id}/reject`, { reason }),
  cancel: (id: string, reason: string) =>
    action("patch", `/bookings/${id}/cancel`, { reason }),
  markNoShow: (id: string) => action("patch", `/bookings/${id}/no-show`),
  checkIn: (id: string, body: CheckInInput) =>
    action("post", `/bookings/${id}/check-in`, body),
  addService: (
    id: string,
    body: { service_id: string; quantity: number; note?: string },
  ) => action("post", `/bookings/${id}/services`, body),
  removeService: (id: string, itemId: string) =>
    action("delete", `/bookings/${id}/services/${itemId}`),
  setDiscount: (id: string, discount: number) =>
    action("patch", `/bookings/${id}/discount`, { discount }),
  checkOut: (id: string, body: CheckOutInput) =>
    action("post", `/bookings/${id}/check-out`, body),

  /* ----- Dữ liệu phụ cho các hộp thoại ----- */

  /** Phòng trống theo khoảng ngày (đã loại phòng bảo trì, phòng trùng lịch) */
  availableRooms: async (params: {
    check_in_date: string;
    check_out_date: string;
    capacity: number;
  }) => {
    const { data } = await axiosInstance.get<Envelope<Paginated<AvailableRoom>>>(
      "/rooms/available",
      {
        params: { ...params, page: 1, limit: 100 },
      },
    );
    return data.data.data;
  },

  /** Trạng thái hiện tại của phòng (nhận phòng cần phòng đang "Trống") */
  roomStatus: async (roomId: string) => {
    const { data } = await axiosInstance.get<
      Envelope<{ status: AvailableRoom["status"] }>
    >(`/rooms/${roomId}`);
    return data.data.status;
  },

  /** Nút "Đã dọn xong" khi nhận phòng: cleaning -> available */
  markRoomCleaned: async (roomId: string) => {
    await axiosInstance.patch(`/rooms/${roomId}/status`, { status: "available" });
  },

  /** Dịch vụ đang bán cho hộp thoại "Thêm dịch vụ": dùng nhiều xếp trước, kèm đơn vị tính */
  services: async (): Promise<ServiceOption[]> => {
    const list = await serviceApi.listActive();
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      unit: s.unit,
    }));
  },
};
