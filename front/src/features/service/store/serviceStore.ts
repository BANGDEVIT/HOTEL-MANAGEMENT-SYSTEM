import { create } from "zustand";
import { toast } from "sonner";
import { serviceApi } from "../../../api/serviceApi";
import type {
  ServiceFilters,
  ServiceItem,
  ServiceStats,
} from "../../../types/service";
import { errorMessage } from "../../../utils/errorMessage";

/**
 * Store chỉ giữ dữ liệu DANH SÁCH + số liệu (toolbar, bảng, ô KPI cùng dùng).
 * Form thêm / sửa, hộp thoại xoá: state cục bộ trong component.
 */

export const DEFAULT_FILTERS: ServiceFilters = {
  page: 1,
  limit: 20,
  search: "",
  category: "",
  status: "all",
  sort: "usage",
  order: "",
};

interface ServiceState {
  services: ServiceItem[];
  total: number;
  totalPages: number;
  filters: ServiceFilters;
  loading: boolean;
  lastUpdated: Date | null;
  stats: ServiceStats | null;

  fetchServices: () => Promise<void>;
  fetchStats: () => Promise<void>;
  /** Đổi bộ lọc rồi tải lại. Đổi bất kỳ lọc nào (trừ page) thì về trang 1 */
  setFilters: (patch: Partial<ServiceFilters>) => void;
  resetFilters: () => void;
  /** Sau khi thêm / xoá: tải lại cả danh sách lẫn số liệu */
  refresh: () => Promise<void>;
  /** Bật tắt / sửa xong: thay đúng 1 dòng bằng dữ liệu BE trả về, không tải lại cả bảng */
  replaceItem: (item: ServiceItem) => void;
}

/** Response về KHÔNG theo thứ tự gửi -> chỉ nhận response của lần gọi mới nhất */
let listRequestId = 0;

export const useServiceStore = create<ServiceState>((set, get) => ({
  services: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  loading: false,
  lastUpdated: null,
  stats: null,

  fetchServices: async () => {
    const requestId = ++listRequestId;
    set({ loading: true });
    try {
      const res = await serviceApi.list(get().filters);
      if (requestId !== listRequestId) return;
      set({
        services: res.data,
        total: res.total,
        totalPages: res.totalPages,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if (requestId !== listRequestId) return;
      toast.error(errorMessage(err, "Không tải được danh sách dịch vụ"));
    } finally {
      if (requestId === listRequestId) set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      set({ stats: await serviceApi.stats() });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được số liệu dịch vụ"));
    }
  },

  setFilters: (patch) => {
    const onlyPage = Object.keys(patch).every((k) => k === "page");
    set((s) => ({
      filters: { ...s.filters, ...patch, ...(onlyPage ? {} : { page: 1 }) },
    }));
    void get().fetchServices();
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS });
    void get().fetchServices();
  },

  refresh: async () => {
    await Promise.all([get().fetchServices(), get().fetchStats()]);
  },

  replaceItem: (item) => {
    set((s) => ({ services: s.services.map((x) => (x.id === item.id ? item : x)) }));
  },
}));
