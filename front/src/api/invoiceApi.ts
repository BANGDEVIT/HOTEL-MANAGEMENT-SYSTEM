import axiosInstance from "./axiosInstance";
import type {
  CollectPaymentInput,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceListItem,
  InvoiceStats,
  Paginated,
} from "../types/invoice";
import { createdRange } from "../features/invoice/utils/invoiceMeta";

/** Mọi response của BE đều bọc trong { success, statusCode, message, data } */
interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Giá trị rỗng / "tất cả" thì BỎ HẲN khỏi query, không gửi chuỗi rỗng (BE báo lỗi validate) */
function toQuery(f: InvoiceFilters) {
  const range = createdRange(f.created);
  return {
    page: f.page,
    limit: f.limit,
    tab: f.tab,
    search: f.search.trim() || undefined,
    method: f.method || undefined,
    from: range?.from,
    to: range?.to,
    sort: f.sort,
    order: f.order,
  };
}

export const invoiceApi = {
  list: async (filters: InvoiceFilters) => {
    const { data } = await axiosInstance.get<Envelope<Paginated<InvoiceListItem>>>(
      "/invoices",
      {
        params: toQuery(filters),
      },
    );
    return data.data;
  },

  stats: async (range: { from: string; to: string }) => {
    const { data } = await axiosInstance.get<Envelope<InvoiceStats>>(
      "/invoices/stats",
      { params: range },
    );
    return data.data;
  },

  detail: async (id: string) => {
    const { data } = await axiosInstance.get<Envelope<InvoiceDetail>>(
      `/invoices/${id}`,
    );
    return data.data;
  },

  byBooking: async (bookingId: string) => {
    const { data } = await axiosInstance.get<Envelope<InvoiceDetail>>(
      `/invoices/booking/${bookingId}`,
    );
    return data.data;
  },

  /* ----- Thu tiền & huỷ phiếu: BE trả về CHI TIẾT HOÁ ĐƠN mới nhất ----- */

  collect: async (body: CollectPaymentInput) => {
    const { data } = await axiosInstance.post<Envelope<InvoiceDetail>>(
      "/payments",
      body,
    );
    return data.data;
  },

  voidPayment: async (paymentId: string, reason: string) => {
    const { data } = await axiosInstance.patch<Envelope<InvoiceDetail>>(
      `/payments/${paymentId}/void`,
      { reason },
    );
    return data.data;
  },
};
