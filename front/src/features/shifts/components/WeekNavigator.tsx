import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isoWeek, weekLabel } from "../utils/week";

export type ShiftView = "grid" | "staff";

interface Props {
  weekStart: string;
  isCurrentWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Trang quản lý truyền 2 prop này -> hiện nút "Theo ca / Theo nhân viên".
   *  Trang nhân viên không truyền -> không hiện. */
  view?: ShiftView;
  onViewChange?: (v: ShiftView) => void;
  /** Nội dung chèn thêm ở bên phải, trước nút chuyển view (nếu có) */
  children?: ReactNode;
}

const VIEWS: { value: ShiftView; label: string }[] = [
  { value: "grid", label: "Theo ca" },
  { value: "staff", label: "Theo nhân viên" },
];

const NAV_BTN =
  "w-7 h-7 rounded-md border border-line bg-white flex items-center justify-center text-ink-secondary hover:bg-row-hover hover:text-ink";

export default function WeekNavigator({
  weekStart,
  isCurrentWeek,
  onPrev,
  onNext,
  onToday,
  view,
  onViewChange,
  children,
}: Props) {
  return (
    <div className="px-5 py-2.5 flex flex-wrap items-center gap-2.5 border-b border-line">
      {/* ===== Bên trái: chuyển tuần ===== */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Tuần trước"
          className={NAV_BTN}
        >
          <ChevronLeft
            size={15}
            strokeWidth={1.75}
          />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Tuần sau"
          className={NAV_BTN}
        >
          <ChevronRight
            size={15}
            strokeWidth={1.75}
          />
        </button>
      </div>

      <div className="text-[14px] font-semibold text-ink tabular-nums">
        {weekLabel(weekStart)}
        <span className="ml-2 text-[11px] font-normal text-ink-muted">
          Tuần {isoWeek(weekStart)}
        </span>
      </div>

      {/* Đang ở tuần này rồi thì nút này vô nghĩa -> ẩn */}
      {!isCurrentWeek && (
        <button
          type="button"
          onClick={onToday}
          className="h-7 px-2.5 rounded-md border border-line text-[12px] text-ink hover:bg-row-hover"
        >
          Về tuần này
        </button>
      )}

      {/* Đẩy mọi thứ phía sau sang sát mép phải */}
      <div className="flex-1" />

      {/* ===== Bên phải ===== */}
      {children}

      {view && onViewChange && (
        <div className="flex border border-line rounded-md overflow-hidden">
          {VIEWS.map((v, i) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => onViewChange(v.value)}
              className={`h-7 px-3 text-[12px] ${i > 0 ? "border-l border-line" : ""} ${
                view === v.value
                  ? "bg-navy-700 text-white font-medium"
                  : "bg-white text-ink-secondary hover:bg-row-hover"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
