export type ShiftName = "morning" | "afternoon" | "evening" | "night";

/** 1 ca trong danh mục — khớp ResponseShiftDto bên BE */
export interface Shift {
  id: string;
  name: ShiftName;
  start_time: string; // "06:00"
  end_time: string; // "14:00"
  is_overnight: boolean; // true = ca kéo qua nửa đêm
}

/** GET /shifts trả thêm số lượt phân công sắp tới */
export interface ShiftListItem extends Shift {
  upcoming_assignments: number;
}

export interface PaginatedShifts {
  data: ShiftListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 1 lượt phân công — khớp ScheduleItemDto bên BE */
export interface ScheduleItem {
  id: string; // id của EmployeeShift
  work_date: string; // "2026-09-28"
  employee: ScheduleEmployee;
  shift: Shift;
}

export interface ScheduleEmployee {
  id: string;
  full_name: string;
  position: string;
  avatar_url: string | null;
}

export interface AssignPayload {
  employee_ids: string[];
  work_date: string;
}

export interface AssignResult {
  shift: Shift;
  work_date: string;
  total_assigned: number; // số người vừa xếp mới
  skipped: number; // số người đã có sẵn, BE bỏ qua
  employees: { id: string; full_name: string; position: string }[];
}

/** Tên ca là enum cố định -> danh mục ca trên FE chỉ cho sửa GIỜ */
export type UpdateShiftPayload = Partial<Pick<Shift, "start_time" | "end_time">>;

/** Nhân viên rút gọn, dùng trong hộp thoại xếp ca */
export interface EmployeeOption {
  id: string;
  full_name: string;
  position: string;
  avatar_url: string | null;
  role: string; // role chính: admin / manager / staff
}

export const SHIFT_LABELS: Record<ShiftName, string> = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  night: "Ca đêm",
};

export const SHIFT_COLOR: Record<ShiftName, string> = {
  morning: "#C77D10",
  afternoon: "#1B3A5C",
  evening: "#0E7C5A",
  night: "#4B3F72",
};

/**
 * Số người cần cho mỗi ca.
 * BE chưa có cột này nên tạm đặt hằng số ở FE.
 * Khi muốn quản lý tự chỉnh được -> thêm `required_staff Int @default(1)` vào model Shift.
 */
export const SHIFT_REQUIRED: Record<ShiftName, number> = {
  morning: 2,
  afternoon: 2,
  evening: 1,
  night: 1,
};

/** Quá số ca này trong 1 tuần thì cột "Số ca" đỏ lên */
export const MAX_SHIFTS_PER_WEEK = 5;
