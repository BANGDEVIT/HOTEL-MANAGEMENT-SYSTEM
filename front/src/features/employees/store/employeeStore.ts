import { create } from "zustand";
import { toast } from "sonner";
import { employeeApi } from "../../../api/employeeApi";
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeFilters,
  UpdateEmployeePayload,
} from "../../../types/employee";

interface EmployeeState {
  employees: Employee[];
  total: number;
  totalPages: number;
  loading: boolean;
  filters: EmployeeFilters;

  setFilters: (f: Partial<EmployeeFilters>) => void;
  fetchEmployees: () => Promise<void>;
  createEmployee: (payload: CreateEmployeePayload) => Promise<void>;
  updateEmployee: (id: string, payload: UpdateEmployeePayload) => Promise<void>;
  lockEmployee: (id: string) => Promise<void>;
  unlockEmployee: (id: string) => Promise<void>;
  resetPassword: (id: string) => Promise<void>;
}

const showError = (e: any, fallback: string) => {
  const msg = e?.response?.data?.message;
  toast.error(Array.isArray(msg) ? msg[0] : (fallback ?? msg));
};

let requestId = 0;

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  total: 0,
  totalPages: 1,
  loading: false,
  // Khách sạn hiếm khi quá 100 nhân viên — tải hết để nhóm theo vai trò có nghĩa
  filters: { search: "", page: 1, limit: 100 },

  setFilters: (f) => {
    set((s) => ({ filters: { ...s.filters, ...f, page: f.page ?? 1 } }));
    get().fetchEmployees();
  },

  fetchEmployees: async () => {
    const current = ++requestId;
    set({ loading: true });
    try {
      const res = await employeeApi.getAll(get().filters);
      if (current !== requestId) return;
      set({ employees: res.data, total: res.total, totalPages: res.totalPages });
    } catch (e) {
      if (current !== requestId) return;
      showError(e, "Không tải được danh sách nhân viên");
    } finally {
      if (current === requestId) set({ loading: false });
    }
  },

  createEmployee: async (payload) => {
    try {
      await employeeApi.create(payload);
      await get().fetchEmployees();
    } catch (e) {
      showError(e, "Không tạo được nhân viên");
      throw e;
    }
  },

  updateEmployee: async (id, payload) => {
    try {
      await employeeApi.update(id, payload);
      await get().fetchEmployees();
    } catch (e) {
      showError(e, "Không lưu được thay đổi");
      throw e;
    }
  },

  lockEmployee: async (id) => {
    try {
      await employeeApi.lock(id);
      await get().fetchEmployees();
    } catch (e) {
      showError(e, "Không khoá được tài khoản");
      throw e;
    }
  },

  unlockEmployee: async (id) => {
    try {
      await employeeApi.update(id, { is_active: true });
      await get().fetchEmployees();
    } catch (e) {
      showError(e, "Không mở khoá được tài khoản");
      throw e;
    }
  },

  resetPassword: async (id) => {
    try {
      await employeeApi.resetPassword(id);
    } catch (e) {
      showError(e, "Không đặt lại được mật khẩu");
      throw e;
    }
  },
}));
