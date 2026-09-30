import { create } from "zustand";
import { toast } from "sonner";
import { invoiceApi } from "../../../api/invoiceApi";
import type {
  InvoiceFilters,
  InvoiceListItem,
  InvoiceStats,
  StatsRange,
} from "../../../types/invoice";
import { errorMessage } from "../../../utils/errorMessage";
import { presetRange } from "../utils/invoiceMeta";

/**
 * Store chỉ giữ dữ liệu DANH SÁCH + THỐNG KÊ (toolbar, bảng, ô số liệu, biểu đồ cùng dùng).
 * Chi tiết 1 hoá đơn và các hộp thoại: state cục bộ trong drawer.
 */

export const DEFAULT_FILTERS: InvoiceFilters = {
  page: 1,
  limit: 20,
  tab: "all",
  search: "",
  method: "",
  created: "",
  sort: "created_at",
  order: "desc",
};

interface InvoiceState {
  invoices: InvoiceListItem[];
  total: number;
  totalPages: number;
  filters: InvoiceFilters;
  loading: boolean;
  lastUpdated: Date | null;

  stats: InvoiceStats | null;
  statsLoading: boolean;
  /** Kỳ thống kê ở đầu trang: CHỈ ảnh hưởng ô số liệu + biểu đồ, không lọc bảng */
  range: StatsRange;

  fetchInvoices: () => Promise<void>;
  fetchStats: () => Promise<void>;
  /** Đổi bộ lọc rồi tải lại. Đổi bất kỳ lọc nào (trừ page) thì về trang 1 */
  setFilters: (patch: Partial<InvoiceFilters>) => void;
  /** Giữ tab đang xem, xoá các lọc còn lại */
  resetFilters: () => void;
  setRange: (range: StatsRange) => void;
  /** Sau mỗi lần thu tiền / huỷ phiếu: tải lại danh sách + thống kê */
  refresh: () => Promise<void>;
}

/** Response về KHÔNG theo thứ tự gửi -> chỉ nhận response của lần gọi mới nhất */
let listRequestId = 0;
let statsRequestId = 0;

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  loading: false,
  lastUpdated: null,

  stats: null,
  statsLoading: false,
  range: { preset: "month", ...presetRange("month") },

  fetchInvoices: async () => {
    const requestId = ++listRequestId;
    set({ loading: true });
    try {
      const res = await invoiceApi.list(get().filters);
      if (requestId !== listRequestId) return;
      set({
        invoices: res.data,
        total: res.total,
        totalPages: res.totalPages,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if (requestId !== listRequestId) return;
      toast.error(errorMessage(err, "Không tải được danh sách hoá đơn"));
    } finally {
      if (requestId === listRequestId) set({ loading: false });
    }
  },

  fetchStats: async () => {
    const requestId = ++statsRequestId;
    set({ statsLoading: true });
    try {
      const { from, to } = get().range;
      const stats = await invoiceApi.stats({ from, to });
      if (requestId === statsRequestId) set({ stats });
    } catch (err) {
      if (requestId === statsRequestId)
        toast.error(errorMessage(err, "Không tải được số liệu thu tiền"));
    } finally {
      if (requestId === statsRequestId) set({ statsLoading: false });
    }
  },

  setFilters: (patch) => {
    const onlyPage = Object.keys(patch).every((k) => k === "page");
    set((s) => ({
      filters: { ...s.filters, ...patch, ...(onlyPage ? {} : { page: 1 }) },
    }));
    void get().fetchInvoices();
  },

  resetFilters: () => {
    set((s) => ({ filters: { ...DEFAULT_FILTERS, tab: s.filters.tab } }));
    void get().fetchInvoices();
  },

  setRange: (range) => {
    set({ range });
    void get().fetchStats();
  },

  refresh: async () => {
    await Promise.all([get().fetchInvoices(), get().fetchStats()]);
  },
}));
