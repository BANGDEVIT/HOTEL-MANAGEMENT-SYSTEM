import axiosInstance from "./axiosInstance";
import type { DashboardOverview } from "../types/dashboard";

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const dashboardApi = {
  /** Mọi số liệu trang Tổng quan trong 1 request */
  overview: async () => {
    const { data } =
      await axiosInstance.get<Envelope<DashboardOverview>>("/dashboard/overview");
    return data.data;
  },
};
