import axiosInstance from "./axiosInstance";
import type { ApiResponse } from "./api";
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeFilters,
  EmployeeListResponse,
  UpdateEmployeePayload,
} from "../types/employee";

export const employeeApi = {
  getAll: async (
    filters: Partial<EmployeeFilters>,
  ): Promise<EmployeeListResponse> => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));

    const { data } = await axiosInstance.get<ApiResponse<EmployeeListResponse>>(
      `/employees?${params}`,
    );
    return data.data;
  },

  create: async (payload: CreateEmployeePayload): Promise<Employee> => {
    const { data } = await axiosInstance.post<ApiResponse<Employee>>(
      "/employees",
      payload,
    );
    return data.data;
  },

  update: async (id: string, payload: UpdateEmployeePayload): Promise<Employee> => {
    const { data } = await axiosInstance.patch<ApiResponse<Employee>>(
      `/employees/${id}`,
      payload,
    );
    return data.data;
  },

  /** Xoá mềm = khoá tài khoản */
  lock: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/employees/${id}`);
  },

  resetPassword: async (id: string): Promise<void> => {
    await axiosInstance.patch(`/employees/${id}/reset-password`);
  },
};
