import type { ShiftName } from "../../../types/shift";
import {
  MAX_SHIFTS_PER_WEEK,
  SHIFT_COLOR,
  SHIFT_LABELS,
} from "../../../types/shift";
import type { StaffRow } from "../utils/schedule";
import { DAY_SHORT, dayMonth } from "../utils/week";
import { EmployeeAvatar } from "./EmployeeChip";

// 1 cột tên + 7 cột ngày + 1 cột tổng = 9 cột
const GRID = "220px repeat(7, minmax(84px, 1fr)) 64px";

const SHORT: Record<ShiftName, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
  evening: "Tối",
  night: "Đêm",
};

interface Props {
  rows: StaffRow[];
  days: string[];
  today: string;
}

export default function StaffGrid({ rows, days, today }: Props) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-[13px] text-ink-muted">
        Chưa có nhân viên nào đang hoạt động
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[872px]">
        {/* ===== Tiêu đề: 1 + 7 + 1 = 9 ô ===== */}
        <div
          className="grid bg-table-head border-b border-line h-10"
          style={{ gridTemplateColumns: GRID }}
        >
          <div className="px-4 flex items-center text-[11px] text-ink-muted">
            Nhân viên
          </div>
          {days.map((day, i) => (
            <div
              key={day}
              className={`border-l border-line flex flex-col items-center justify-center ${
                day === today ? "bg-[#FFF9EC] shadow-[inset_0_-2px_0_#C9A84C]" : ""
              }`}
            >
              <span className="text-[11px] font-semibold text-ink">
                {DAY_SHORT[i]}
              </span>
              <span className="text-[10px] text-ink-muted tabular-nums">
                {dayMonth(day)}
              </span>
            </div>
          ))}
          <div className="border-l border-line flex items-center justify-center text-[11px] text-ink-muted">
            Số ca
          </div>
        </div>

        {/* ===== Mỗi nhân viên: 1 + 7 + 1 = 9 ô ===== */}
        {rows.map((row) => {
          const over = row.total > MAX_SHIFTS_PER_WEEK;
          return (
            <div
              key={row.employee.id}
              className="grid min-h-[48px] border-b border-line-soft hover:bg-row-hover"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="px-4 flex items-center gap-2.5 min-w-0">
                <EmployeeAvatar
                  name={row.employee.full_name}
                  url={row.employee.avatar_url}
                  size={28}
                />
                <div className="min-w-0">
                  <div
                    className={`text-[13px] truncate ${
                      row.total ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    {row.employee.full_name}
                  </div>
                  <div className="text-[11px] text-ink-muted truncate">
                    {row.employee.position}
                  </div>
                </div>
              </div>

              {row.byDay.map((shift, i) => (
                <div
                  key={days[i]}
                  className={`border-l border-line-soft p-[5px] flex items-center ${
                    days[i] === today ? "bg-[#FFFCF4]" : ""
                  }`}
                >
                  {shift ? (
                    <div
                      title={`${SHIFT_LABELS[shift.name]} ${shift.start_time} – ${shift.end_time}`}
                      className="w-full h-[26px] rounded-[5px] text-white text-[11px] font-medium flex items-center justify-center"
                      style={{ background: SHIFT_COLOR[shift.name] }}
                    >
                      {SHORT[shift.name]}
                    </div>
                  ) : (
                    <span className="w-full text-center text-[12px] text-[#CDD2D8]">
                      –
                    </span>
                  )}
                </div>
              ))}

              <div
                className={`border-l border-line-soft flex items-center justify-center text-[13px] font-semibold tabular-nums ${
                  over ? "text-[#B4321F]" : "text-ink"
                }`}
                title={over ? `Quá ${MAX_SHIFTS_PER_WEEK} ca mỗi tuần` : undefined}
              >
                {row.total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
