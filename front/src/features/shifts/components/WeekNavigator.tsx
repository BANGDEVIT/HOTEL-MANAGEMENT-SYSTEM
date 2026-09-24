import { ChevronLeft, ChevronRight } from "lucide-react";
import { isoWeek, weekLabel } from "../utils/week";

export type ShiftView = "grid" | "staff";

interface Props {
  weekStart: string;
  isCurrentWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  view: ShiftView;
  onViewChange: (v: ShiftView) => void;
}

const VIEWS: { value: ShiftView; label: string }[] = [
  { value: "grid", label: "Theo ca" },
  { value: "staff", label: "Theo nhân viên" },
];

export default function WeekNavigator({
  weekStart,
  isCurrentWeek,
  onPrev,
  onNext,
  onToday,
  view,
  onViewChange,
}: Props) {
  const navBtn =
    "w-7 h-7 rounded-md border border-[#E4E6E9] bg-white flex items-center justify-center text-[#5C6672] hover:bg-[#F5F6F7] hover:text-[#14181D]";

  return (
    <div className="px-5 py-2.5 flex items-center gap-2.5 border-b border-[#E4E6E9]">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Tuần trước"
          className={navBtn}
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
          className={navBtn}
        >
          <ChevronRight
            size={15}
            strokeWidth={1.75}
          />
        </button>
      </div>

      <div className="text-[14px] font-semibold text-[#14181D] tabular-nums">
        {weekLabel(weekStart)}
        <span className="ml-2 text-[11px] font-normal text-[#98A1AC]">
          Tuần {isoWeek(weekStart)}
        </span>
      </div>

      {/* Đang ở tuần này rồi thì nút này vô nghĩa -> ẩn */}
      {!isCurrentWeek && (
        <button
          type="button"
          onClick={onToday}
          className="h-7 px-2.5 rounded-md border border-[#E4E6E9] text-[12px] text-[#14181D] hover:bg-[#F5F6F7]"
        >
          Về tuần này
        </button>
      )}

      <div className="flex-1" />

      <div className="flex border border-[#E4E6E9] rounded-md overflow-hidden">
        {VIEWS.map((v, i) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => onViewChange(v.value)}
            className={`h-7 px-3 text-[12px] ${i > 0 ? "border-l border-[#E4E6E9]" : ""} ${
              view === v.value
                ? "bg-[#1B3A5C] text-white font-medium"
                : "bg-white text-[#5C6672] hover:bg-[#F5F6F7]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
