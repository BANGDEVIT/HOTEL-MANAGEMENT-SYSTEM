import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";
import { shiftApi } from "../../../api/shiftApi";
import type {
  AssignResult,
  EmployeeOption,
  ScheduleItem,
  Shift,
  UpdateShiftPayload,
} from "../../../types/shift";
import { addDaysYmd, mondayOf, todayYmd } from "../utils/week";

/** Lấy message lỗi từ BE. ValidationPipe trả mảng, HttpException trả chuỗi */
function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) return msg[0];
    if (typeof msg === "string") return msg;
  }
  return fallback;
}

/**
 * Bộ đếm request, đặt NGOÀI store.
 * Chỉ dùng để so sánh "response này còn đúng tuần đang xem không",
 * không cần làm component render lại khi nó tăng.
 */
let scheduleRequestId = 0;

interface ShiftState {
  weekStart: string; // thứ 2 của tuần đang xem, "YYYY-MM-DD"
  shifts: Shift[];
  schedule: ScheduleItem[];
  employees: EmployeeOption[];
  loadingShifts: boolean;
  loadingSchedule: boolean;
  lastUpdated: Date | null;

  fetchShifts: () => Promise<void>;
  fetchEmployees: () => Promise<void>;
  fetchSchedule: (opts?: { silent?: boolean }) => Promise<void>;

  goToWeek: (ymd: string) => void;
  prevWeek: () => void;
  nextWeek: () => void;
  thisWeek: () => void;

  assign: (
    shiftId: string,
    workDate: string,
    employeeIds: string[],
  ) => Promise<AssignResult>;
  unassign: (item: ScheduleItem) => Promise<void>;
  updateShift: (id: string, payload: UpdateShiftPayload) => Promise<void>;
}

const byStartTime = (a: Shift, b: Shift) => a.start_time.localeCompare(b.start_time);

export const useShiftStore = create<ShiftState>()((set, get) => ({
  // Lưu string thay vì Date: so sánh bằng === được, và không bị đổi tham chiếu vô cớ
  weekStart: mondayOf(todayYmd()),
  shifts: [],
  schedule: [],
  employees: [],
  loadingShifts: false,
  loadingSchedule: false,
  lastUpdated: null,

  /* ---------------- tải dữ liệu ---------------- */

  fetchShifts: async () => {
    set({ loadingShifts: true });
    try {
      const shifts = await shiftApi.getAll();
      set({ shifts: [...shifts].sort(byStartTime) });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được danh mục ca"));
    } finally {
      set({ loadingShifts: false });
    }
  },

  fetchEmployees: async () => {
    try {
      set({ employees: await shiftApi.getEmployeeOptions() });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được danh sách nhân viên"));
    }
  },

  /**
   * silent = true: tải lại ngầm sau khi xếp ca / sửa ca,
   * KHÔNG làm mờ lưới và không hiện thanh loading.
   */
  fetchSchedule: async ({ silent = false } = {}) => {
    const requestId = ++scheduleRequestId;
    const week = get().weekStart;

    if (!silent) set({ loadingSchedule: true });

    try {
      const schedule = await shiftApi.getSchedule(week);
      // Người dùng bấm ‹ › liên tục: chỉ nhận response của lần bấm CUỐI CÙNG
      if (requestId !== scheduleRequestId) return;
      set({ schedule, lastUpdated: new Date() });
    } catch (err) {
      if (requestId !== scheduleRequestId) return;
      toast.error(errorMessage(err, "Không tải được lịch làm việc"));
    } finally {
      // Chỉ request mới nhất mới được tắt loading
      if (requestId === scheduleRequestId) set({ loadingSchedule: false });
    }
  },

  /* ---------------- điều hướng tuần ---------------- */

  goToWeek: (ymd) => {
    const monday = mondayOf(ymd);
    if (monday === get().weekStart) return; // đang ở tuần đó rồi, khỏi gọi API
    // GIỮ lịch cũ trên màn hình (làm mờ) cho tới khi lịch mới về, giống trang Phòng
    set({ weekStart: monday });
    get().fetchSchedule();
  },

  prevWeek: () => get().goToWeek(addDaysYmd(get().weekStart, -7)),
  nextWeek: () => get().goToWeek(addDaysYmd(get().weekStart, 7)),
  thisWeek: () => get().goToWeek(todayYmd()),

  /* ---------------- thao tác ---------------- */

  assign: async (shiftId, workDate, employeeIds) => {
    try {
      const result = await shiftApi.assign(shiftId, {
        employee_ids: employeeIds,
        work_date: workDate,
      });
      // Response của assign KHÔNG có id EmployeeShift, mà nút gỡ cần id đó
      // -> tải lại ngầm để lấy dữ liệu thật
      await get().fetchSchedule({ silent: true });
      return result;
    } catch (err) {
      toast.error(errorMessage(err, "Xếp ca thất bại"));
      throw err; // để dialog biết mà KHÔNG đóng
    }
  },

  /**
   * Optimistic update: gỡ khỏi màn hình NGAY, rồi mới gọi API.
   * Bấm × là chip biến mất liền, không phải chờ mạng.
   * API lỗi thì trả chip về chỗ cũ.
   */
  unassign: async (item) => {
    set((state) => ({ schedule: state.schedule.filter((s) => s.id !== item.id) }));

    try {
      await shiftApi.unassign(item.shift.id, item.employee.id, item.work_date);
    } catch (err) {
      set((state) =>
        // Người dùng đã chuyển sang tuần khác thì thôi, đừng nhét chip vào tuần sai
        state.weekStart === mondayOf(item.work_date)
          ? { schedule: [...state.schedule, item] }
          : state,
      );
      toast.error(errorMessage(err, "Gỡ ca thất bại"));
      throw err;
    }
  },

  updateShift: async (id, payload) => {
    try {
      const updated = await shiftApi.update(id, payload);
      set((state) => ({
        shifts: state.shifts
          .map((s) => (s.id === id ? { ...s, ...updated } : s))
          .sort(byStartTime), // đổi giờ có thể làm đổi thứ tự sáng / chiều / đêm
      }));
      // Mỗi dòng lịch đang nhúng thông tin ca CŨ -> tải lại ngầm
      get().fetchSchedule({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Cập nhật ca thất bại"));
      throw err;
    }
  },
}));
