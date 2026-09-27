import { create } from "zustand";
import { toast } from "sonner";
import { customerApi } from "../../../api/customerApi";
import type {
  CustomerFilters,
  CustomerListItem,
  CustomerStats,
} from "../../../types/customer";
import { errorMessage } from "@/utils/errorMessage";

/**
 * Store chỉ giữ dữ liệu DANH SÁCH (dùng chung nhiều component: toolbar, bảng, ô thống kê).
 * Chi tiết 1 khách, lịch sử booking, ghi chú: chỉ ngăn hồ sơ dùng -> để state cục bộ trong ngăn đó.
 */

export const DEFAULT_FILTERS: CustomerFilters = {
  page: 1,
  limit: 20,
  search: "",
  nationality: "",
  membership: "all",
  stay: [],
  sort: "created_at",
  order: "desc",
};

interface CustomerState {
  customers: CustomerListItem[];
  total: number;
  totalPages: number;
  filters: CustomerFilters;
  loading: boolean;
  lastUpdated: Date | null;

  stats: CustomerStats | null;

  fetchCustomers: () => Promise<void>;
  fetchStats: () => Promise<void>;
  /** Đổi bộ lọc rồi tải lại. Đổi bất kỳ lọc nào (trừ page) thì quay về trang 1 */
  setFilters: (patch: Partial<CustomerFilters>) => void;
  resetFilters: () => void;
  /** Sau khi thêm / sửa khách: tải lại cả danh sách lẫn số liệu */
  refresh: () => Promise<void>;
}

/**
 * Đếm số lần gọi. Gõ tìm kiếm nhanh -> nhiều request chạy song song,
 * response về KHÔNG theo thứ tự gửi. Chỉ nhận response của lần gọi mới nhất.
 */
let listRequestId = 0;

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  loading: false,
  lastUpdated: null,
  stats: null,

  fetchCustomers: async () => {
    const requestId = ++listRequestId;
    set({ loading: true });
    try {
      const res = await customerApi.list(get().filters);
      if (requestId !== listRequestId) return; // đã có lần gọi mới hơn
      set({
        customers: res.data,
        total: res.total,
        totalPages: res.totalPages,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if (requestId !== listRequestId) return;
      toast.error(errorMessage(err, "Không tải được danh sách khách"));
    } finally {
      if (requestId === listRequestId) set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      set({ stats: await customerApi.stats() });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được số liệu khách"));
    }
  },

  setFilters: (patch) => {
    const changesPage = Object.keys(patch).every((k) => k === "page");
    set((s) => ({
      filters: { ...s.filters, ...patch, ...(changesPage ? {} : { page: 1 }) },
    }));
    void get().fetchCustomers();
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS });
    void get().fetchCustomers();
  },

  refresh: async () => {
    await Promise.all([get().fetchCustomers(), get().fetchStats()]);
  },
}));
