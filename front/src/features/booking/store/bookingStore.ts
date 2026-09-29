import { create } from "zustand";
import { toast } from "sonner";
import { bookingApi } from "../../../api/bookingApi";
import type {
  BookingFilters,
  BookingListItem,
  BookingStats,
} from "../../../types/booking";
import { errorMessage } from "../../../utils/errorMessage";

/**
 * Store chỉ giữ dữ liệu DANH SÁCH (toolbar, bảng, ô số liệu cùng dùng).
 * Chi tiết 1 booking và các hộp thoại: state cục bộ trong drawer.
 */

export const DEFAULT_FILTERS: BookingFilters = {
  page: 1,
  limit: 20,
  tab: "arrivals", // mở màn hình là thấy ngay khách đến hôm nay
  search: "",
  booking_type: "",
  from: "",
  to: "",
  sort: "",
  order: "",
};

interface BookingState {
  bookings: BookingListItem[];
  total: number;
  totalPages: number;
  filters: BookingFilters;
  loading: boolean;
  lastUpdated: Date | null;
  stats: BookingStats | null;

  fetchBookings: () => Promise<void>;
  fetchStats: () => Promise<void>;
  /** Đổi bộ lọc rồi tải lại. Đổi bất kỳ lọc nào (trừ page) thì về trang 1 */
  setFilters: (patch: Partial<BookingFilters>) => void;
  /** Giữ tab đang xem, xoá các lọc còn lại */
  resetFilters: () => void;
  /** Sau mỗi thao tác: tải lại danh sách + số trên tab */
  refresh: () => Promise<void>;
}

/** Response về KHÔNG theo thứ tự gửi -> chỉ nhận response của lần gọi mới nhất */
let listRequestId = 0;

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  loading: false,
  lastUpdated: null,
  stats: null,

  fetchBookings: async () => {
    const requestId = ++listRequestId;
    set({ loading: true });
    try {
      const res = await bookingApi.list(get().filters);
      if (requestId !== listRequestId) return;
      set({
        bookings: res.data,
        total: res.total,
        totalPages: res.totalPages,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if (requestId !== listRequestId) return;
      toast.error(errorMessage(err, "Không tải được danh sách đặt phòng"));
    } finally {
      if (requestId === listRequestId) set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      set({ stats: await bookingApi.stats() });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được số liệu đặt phòng"));
    }
  },

  setFilters: (patch) => {
    const onlyPage = Object.keys(patch).every((k) => k === "page");
    set((s) => ({
      filters: { ...s.filters, ...patch, ...(onlyPage ? {} : { page: 1 }) },
    }));
    void get().fetchBookings();
  },

  resetFilters: () => {
    set((s) => ({ filters: { ...DEFAULT_FILTERS, tab: s.filters.tab } }));
    void get().fetchBookings();
  },

  refresh: async () => {
    await Promise.all([get().fetchBookings(), get().fetchStats()]);
  },
}));
