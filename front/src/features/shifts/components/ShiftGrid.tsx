import { Fragment } from "react";
import type { ScheduleItem, Shift } from "../../../types/shift";
import { SHIFT_COLOR, SHIFT_LABELS, SHIFT_REQUIRED } from "../../../types/shift";
import { cellKey } from "../utils/schedule";
import { DAY_LABELS, dayMonth } from "../utils/week";
import ShiftSlot from "./ShiftSlot";

// 1 cột nhãn ca + 7 cột ngày = 8 cột
const GRID = "148px repeat(7, minmax(124px, 1fr))";

// Tạo 1 lần ngoài component: ô trống luôn nhận CÙNG 1 mảng,
// không phải mỗi lần render lại tạo một [] mới
const EMPTY: ScheduleItem[] = [];

interface Props {
  shifts: Shift[];
  days: string[];
  cells: Map<string, ScheduleItem[]>;
  today: string;
  /** true = trang nhân viên: không thêm, không gỡ, không cảnh báo thiếu người */
  readOnly?: boolean;
  /** id nhân viên đang đăng nhập -> ô của người đó được viền vàng */
  highlightId?: string;
  /** Trang quản lý truyền. Trang nhân viên không truyền. */
  onAdd?: (shift: Shift, day: string) => void;
  onRemove?: (item: ScheduleItem) => Promise<void>;
}

export default function ShiftGrid({
  shifts,
  days,
  cells,
  today,
  readOnly = false,
  highlightId,
  onAdd,
  onRemove,
}: Props) {
  if (shifts.length === 0) {
    return (
      <div className="py-16 text-center text-[13px] text-[#98A1AC]">
        Chưa có ca nào trong danh mục
      </div>
    );
  }

  return (
    // Màn hình hẹp thì cuộn ngang, không bóp ô tới mức chữ bị cắt
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[1016px]"
        style={{ gridTemplateColumns: GRID }}
      >
        {/* ===== Hàng tiêu đề: 1 ô góc + 7 ô ngày = 8 ô ===== */}
        <div className="bg-[#F5F6F7] border-b border-[#E4E6E9]" />
        {days.map((day, i) => {
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`px-2.5 py-2 border-b border-l border-[#E4E6E9] ${
                isToday
                  ? "bg-[#FFF9EC] shadow-[inset_0_-2px_0_#C9A84C]"
                  : "bg-[#F5F6F7]"
              }`}
            >
              <div
                className={`text-[12px] font-semibold ${
                  day < today ? "text-[#98A1AC]" : "text-[#14181D]"
                }`}
              >
                {DAY_LABELS[i]}
              </div>
              <div className="text-[11px] text-[#98A1AC] tabular-nums mt-px">
                {dayMonth(day)}
                {isToday && ", hôm nay"}
              </div>
            </div>
          );
        })}

        {/* ===== Mỗi ca: 1 ô nhãn + 7 ô ngày = 8 ô ===== */}
        {shifts.map((shift) => (
          // Fragment có key: gom 8 ô của 1 ca mà không sinh thêm thẻ div.
          // Thêm div thì div đó bị tính là 1 ô và phá vỡ grid.
          <Fragment key={shift.id}>
            <ShiftRowLabel
              shift={shift}
              showRequired={!readOnly}
            />
            {days.map((day) => (
              <ShiftSlot
                key={day}
                shift={shift}
                day={day}
                items={cells.get(cellKey(shift.id, day)) ?? EMPTY}
                isToday={day === today}
                // readOnly -> mọi ngày đều khoá: ẩn nút Thêm, ẩn ×, ẩn cảnh báo thiếu
                locked={readOnly || day < today}
                highlightId={highlightId}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Nhỏ và chỉ dùng trong file này -> để chung, không tách file riêng */
function ShiftRowLabel({
  shift,
  showRequired,
}: {
  shift: Shift;
  showRequired: boolean;
}) {
  return (
    <div className="flex gap-2.5 px-3 py-2.5 border-b border-[#F0F1F3]">
      <span
        className="w-[3px] self-stretch rounded-full shrink-0"
        style={{ background: SHIFT_COLOR[shift.name] }}
      />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[#14181D]">
          {SHIFT_LABELS[shift.name]}
        </div>
        <div className="text-[11px] text-[#5C6672] tabular-nums mt-px">
          {shift.start_time} – {shift.end_time}
          {shift.is_overnight && " hôm sau"}
        </div>
        {/* "Cần N người" là thông tin cho quản lý, nhân viên không cần xem */}
        {showRequired && (
          <div className="text-[11px] text-[#98A1AC] mt-1">
            Cần {SHIFT_REQUIRED[shift.name]} người
          </div>
        )}
      </div>
    </div>
  );
}
