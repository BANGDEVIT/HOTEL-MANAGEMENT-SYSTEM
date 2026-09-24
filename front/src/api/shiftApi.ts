import axiosInstance from "./axiosInstance";
import type { ApiResponse } from "./api";
import type {
  AssignPayload,
  AssignResult,
  EmployeeOption,
  PaginatedShifts,
  ScheduleItem,
  Shift,
  ShiftListItem,
  UpdateShiftPayload,
} from "../types/shift";
import type { Employee } from "../types/employee";
import { primaryRole } from "../types/employee";

export const shiftApi = {
  async getAll(): Promise<ShiftListItem[]> {
    const { data } = await axiosInstance.get<ApiResponse<PaginatedShifts>>(
      "/shifts",
      {
        params: { limit: 20 },
      },
    );
    // data           -> body axios nhận về         = ApiResponse
    // data.data      -> phần TransformInterceptor bọc = PaginatedShifts
    // data.data.data -> mảng ca
    return data.data.data;
  },

  async update(id: string, payload: UpdateShiftPayload): Promise<Shift> {
    const { data } = await axiosInstance.patch<ApiResponse<Shift>>(
      `/shifts/${id}`,
      payload,
    );
    return data.data;
  },

  /** week: 1 ngày bất kỳ trong tuần, BE tự tính thứ 2 -> chủ nhật */
  async getSchedule(week: string): Promise<ScheduleItem[]> {
    const { data } = await axiosInstance.get<ApiResponse<ScheduleItem[]>>(
      "/shifts/schedule",
      {
        params: { week },
      },
    );
    return data.data;
  },

  async assign(shiftId: string, payload: AssignPayload): Promise<AssignResult> {
    const { data } = await axiosInstance.post<ApiResponse<AssignResult>>(
      `/shifts/${shiftId}/employees`,
      payload,
    );
    return data.data;
  },

  async unassign(
    shiftId: string,
    employeeId: string,
    workDate: string,
  ): Promise<void> {
    await axiosInstance.delete(`/shifts/${shiftId}/employees/${employeeId}`, {
      params: { work_date: workDate },
    });
  },

  /** Nhân viên còn hoạt động, để chọn khi xếp ca */
  async getEmployeeOptions(): Promise<EmployeeOption[]> {
    const { data } = await axiosInstance.get<ApiResponse<{ data: Employee[] }>>(
      "/employees",
      {
        params: { limit: 100 },
      },
    );
    return data.data.data
      .filter((e: any) => e.account.is_active) // người bị khoá thì BE cũng chặn, lọc sẵn cho gọn
      .map((e: any) => ({
        id: e.id,
        full_name: e.full_name ?? `${e.last_name} ${e.first_name}`,
        position: e.position,
        avatar_url: e.avatar_url ?? null,
        role: primaryRole(e),
      }));
  },
};
