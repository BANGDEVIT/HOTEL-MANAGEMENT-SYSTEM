export type EmployeeRole = "admin" | "manager" | "staff";
export type Gender = "male" | "female" | "other";

export interface EmployeeAccount {
  id: string;
  email: string;
  is_active: boolean;
  roles: string[];
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  position: string;
  gender: string;
  salary: number;
  hired_date: string;
  avatar_url: string | null;
  account: EmployeeAccount;
}

export interface EmployeeListResponse {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmployeeFilters {
  search: string;
  page: number;
  limit: number;
}

export interface CreateEmployeePayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  gender: Gender;
  salary: number;
  hired_date: string;
  role: "manager" | "staff";
}

export interface UpdateEmployeePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  position?: string;
  gender?: Gender;
  salary?: number;
  hired_date?: string;
  is_active?: boolean;
}

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  staff: "Nhân viên",
};

/** Thứ tự nhóm trên trang — cấp cao lên trước */
export const ROLE_ORDER: EmployeeRole[] = ["admin", "manager", "staff"];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

/** Vai trò chính của một nhân viên — tài khoản có thể mang nhiều role,
 *  lấy role cao nhất để nhóm */
export const primaryRole = (e: Employee): EmployeeRole =>
  ROLE_ORDER.find((r) => e.account.roles?.includes(r)) ?? "staff";

/** "2 năm 4 tháng", "5 tháng", "Mới vào" */
export const tenure = (hiredDate: string): string => {
  const start = new Date(hiredDate);
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months <= 0) return "Mới vào";

  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} tháng`;
  return rest === 0 ? `${years} năm` : `${years} năm ${rest} tháng`;
};

export const initials = (e: Employee) =>
  `${e.last_name?.[0] ?? ""}${e.first_name?.[0] ?? ""}`.toUpperCase();
