import { Plus } from "lucide-react";
import type { ScheduleItem, Shift } from "../../../types/shift";
import { SHIFT_LABELS, SHIFT_REQUIRED } from "../../../types/shift";
import { dayMonth } from "../utils/week";
import EmployeeChip from "./EmployeeChip";

interface Props {
  shift: Shift;
  day: string;
  items: ScheduleItem[];
  isToday: boolean;
  /** true = ngày đã qua hoặc trang chỉ xem: ẩn nút Thêm, ẩn ×, ẩn cảnh báo thiếu */
  locked: boolean;
  /** id nhân viên đang đăng nhập -> chip của người đó viền vàng */
  highlightId?: string;
  /** Trang quản lý truyền. Trang nhân viên không truyền. */
  onAdd?: (shift: Shift, day: string) => void;
  onRemove?: (item: ScheduleItem) => Promise<void>;
}

export default function ShiftSlot({
  shift,
  day,
  items,
  isToday,
  locked,
  highlightId,
  onAdd,
  onRemove,
}: Props) {
  const missing = Math.max(0, SHIFT_REQUIRED[shift.name] - items.length);
  // Ô bị khoá thì dù thiếu người cũng không cảnh báo, vì không làm gì được ở ô đó
  const short = missing > 0 && !locked;

  const bg = short
    ? "bg-[#FDF4F2] hover:bg-[#FBEDEA]"
    : isToday
      ? "bg-[#FFFCF4]"
      : "hover:bg-[#FAFBFB]";

  return (
    // "group": để nút Thêm bên trong chỉ hiện khi di chuột vào ô này
    <div
      className={`group relative min-h-[96px] p-[7px] pb-[5px] border-b border-l border-[#F0F1F3] transition-colors ${bg}`}
    >
      {items.map((item) => (
        <EmployeeChip
          key={item.id}
          item={item}
          highlight={item.employee.id === highlightId}
          // Ô khoá thì không truyền onRemove -> chip không hiện nút ×
          onRemove={locked ? undefined : onRemove}
        />
      ))}

      {short && (
        <div className="text-[10.5px] font-medium text-[#B4321F] mt-0.5 mb-1">
          Thiếu {missing} người
        </div>
      )}

      {/* Cần cả 2 điều kiện: ô chưa khoá VÀ trang có truyền onAdd */}
      {!locked && onAdd && (
        <button
          type="button"
          onClick={() => onAdd(shift, day)}
          aria-label={`Thêm nhân viên vào ${SHIFT_LABELS[shift.name].toLowerCase()} ngày ${dayMonth(day)}`}
          // Ô thiếu người: nút luôn hiện, vì đó là việc cần làm.
          // Ô đủ người: chỉ hiện khi di chuột vào hoặc bấm Tab tới, để bảng gọn lúc chỉ đọc.
          className={`w-full h-6 rounded-[5px] border border-dashed border-[#CDD2D8] text-[11px] text-[#98A1AC] flex items-center justify-center gap-1 transition-opacity hover:border-[#1B3A5C] hover:text-[#1B3A5C] hover:bg-white focus-visible:opacity-100 ${
            short ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Plus
            size={12}
            strokeWidth={2}
          />
          Thêm
        </button>
      )}
    </div>
  );
}
