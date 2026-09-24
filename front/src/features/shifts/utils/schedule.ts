import type {
  EmployeeOption,
  ScheduleEmployee,
  ScheduleItem,
  Shift,
} from "../../../types/shift";
import { SHIFT_REQUIRED } from "../../../types/shift";

/** Khoá của 1 ô trong lưới: "shiftId|2026-09-28" */
export const cellKey = (shiftId: string, ymd: string) => `${shiftId}|${ymd}`;

/**
 * Gom mảng lịch phẳng thành Map theo ô (ca × ngày).
 * Duyệt mảng đúng 1 lần -> 100 lượt phân công là 100 bước.
 * Nếu mỗi ô lại tự .filter() cả mảng thì thành 21 ô × 100 = 2100 bước.
 */
export function groupByCell(schedule: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>();
  for (const item of schedule) {
    const key = cellKey(item.shift.id, item.work_date);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export interface WeekTally {
  required: number; // tổng suất trực cần trong tuần
  filled: number; // số suất đã có người
  missing: number; // số suất còn trống
  staffCount: number; // số nhân viên khác nhau có ca trong tuần
  shortCells: number; // số ô thiếu người
  nightShortCells: number; // trong đó bao nhiêu ô là ca đêm
}

export function computeTally(
  shifts: Shift[],
  days: string[],
  cells: Map<string, ScheduleItem[]>,
): WeekTally {
  const tally: WeekTally = {
    required: 0,
    filled: 0,
    missing: 0,
    staffCount: 0,
    shortCells: 0,
    nightShortCells: 0,
  };
  const staff = new Set<string>();

  for (const shift of shifts) {
    const need = SHIFT_REQUIRED[shift.name];

    for (const day of days) {
      const people = cells.get(cellKey(shift.id, day)) ?? [];
      const miss = Math.max(0, need - people.length);

      tally.required += need;
      // Ô dư người KHÔNG được bù cho ô thiếu -> lấy min
      tally.filled += Math.min(people.length, need);
      tally.missing += miss;

      if (miss > 0) {
        tally.shortCells++;
        if (shift.name === "night") tally.nightShortCells++;
      }
      people.forEach((p) => staff.add(p.employee.id));
    }
  }

  tally.staffCount = staff.size;
  return tally;
}

export interface StaffRow {
  employee: ScheduleEmployee;
  byDay: (Shift | null)[]; // 7 phần tử, null = nghỉ
  total: number;
}

/**
 * Bảng "theo nhân viên": mỗi người 1 dòng, 7 cột ngày.
 * Truyền thêm employees để hiện cả người KHÔNG có ca nào trong tuần
 * (quản lý cần thấy ai đang rảnh để xếp vào ô thiếu).
 */
export function buildStaffRows(
  schedule: ScheduleItem[],
  days: string[],
  employees: EmployeeOption[] = [],
): StaffRow[] {
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const rows = new Map<string, StaffRow>();

  const ensureRow = (employee: ScheduleEmployee): StaffRow => {
    let row = rows.get(employee.id);
    if (!row) {
      row = { employee, byDay: Array(7).fill(null), total: 0 };
      rows.set(employee.id, row);
    }
    return row;
  };

  for (const e of employees) {
    ensureRow({
      id: e.id,
      full_name: e.full_name,
      position: e.position,
      avatar_url: e.avatar_url,
    });
  }

  for (const item of schedule) {
    const idx = dayIndex.get(item.work_date);
    if (idx === undefined) continue; // không thuộc tuần đang xem
    const row = ensureRow(item.employee);
    row.byDay[idx] = item.shift;
    row.total++;
  }

  // Nhiều ca nhất lên đầu, bằng nhau thì theo tên (so sánh kiểu tiếng Việt)
  return [...rows.values()].sort(
    (a, b) =>
      b.total - a.total ||
      a.employee.full_name.localeCompare(b.employee.full_name, "vi"),
  );
}

/** "Nguyễn Thị Lan" -> "NL" (chữ đầu của họ + chữ đầu của tên) */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
