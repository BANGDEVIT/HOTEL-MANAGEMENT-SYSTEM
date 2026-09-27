import { useEffect, useMemo, useState } from "react";
import { useMyShiftStore } from "../store/myShiftStore";
import { useShiftStore } from "../store/shiftStore";
import { mondayOf, todayYmd, weekDays } from "../utils/week";
import { shiftHours } from "../utils/time";
import { groupByCell } from "../utils/schedule";
import NextShiftCard from "./NextShiftCard";
import WeekNavigator from "./WeekNavigator";
import LoadingBar from "@/components/LoadingBar";
import ShiftGrid from "./ShiftGrid";
import { SHIFT_COLOR, SHIFT_LABELS } from "@/types/shift";

export default function MyShifts() {
  // Lưới dùng chung store với trang quản lý
  const weekStart = useShiftStore((s) => s.weekStart);
  const shifts = useShiftStore((s) => s.shifts);
  const schedule = useShiftStore((s) => s.schedule);
  const loadingSchedule = useShiftStore((s) => s.loadingSchedule);
  const lastUpdated = useShiftStore((s) => s.lastUpdated);
  const fetchShifts = useShiftStore((s) => s.fetchShifts);
  const fetchSchedule = useShiftStore((s) => s.fetchSchedule);
  const prevWeek = useShiftStore((s) => s.prevWeek);
  const nextWeek = useShiftStore((s) => s.nextWeek);
  const thisWeek = useShiftStore((s) => s.thisWeek);

  const employeeId = useMyShiftStore((s) => s.employeeId);
  const nextShift = useMyShiftStore((s) => s.nextShift);
  const nextLoaded = useMyShiftStore((s) => s.nextLoaded);
  const fetchMe = useMyShiftStore((s) => s.fetchMe);
  const fetchNextShift = useMyShiftStore((s) => s.fetchNextShift);

  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    fetchShifts();
    fetchSchedule();
    fetchMe();
    fetchNextShift();
    // KHÔNG gọi fetchEmployees: API /employees chỉ manager/admin được gọi, staff sẽ bị 403
  }, [fetchShifts, fetchSchedule, fetchMe, fetchNextShift]);

  const today = todayYmd();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  // Ca của riêng mình trong tuần đang xem
  const mine = useMemo(
    () =>
      employeeId ? schedule.filter((i: any) => i.employee.id === employeeId) : [],
    [schedule, employeeId],
  );
  const myHours = mine.reduce((sum: any, i: any) => sum + shiftHours(i.shift), 0);

  // Lọc TRƯỚC khi gom ô: "Chỉ ca của tôi" chỉ là đổi đầu vào, lưới giữ nguyên
  const cells = useMemo(
    () => groupByCell(onlyMine ? mine : schedule),
    [onlyMine, mine, schedule],
  );

  const firstLoad = lastUpdated === null;

  return (
    <div className="bg-white border border-[#E4E6E9] rounded-[10px] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E4E6E9]">
        <h1 className="text-[19px] font-semibold text-[#14181D] tracking-[-0.01em]">
          Lịch làm việc
        </h1>
        <p className="text-[12px] text-[#98A1AC] mt-0.5">
          Lịch do quản lý xếp. Cần đổi ca thì báo quản lý.
        </p>
      </div>

      <NextShiftCard
        nextShift={nextShift}
        loaded={nextLoaded}
        onExpired={fetchNextShift}
      />

      <WeekNavigator
        weekStart={weekStart}
        isCurrentWeek={weekStart === mondayOf(today)}
        onPrev={prevWeek}
        onNext={nextWeek}
        onToday={thisWeek}
      >
        <span className="text-[12px] text-[#5C6672] tabular-nums mr-2">
          Tuần này bạn có {mine.length} ca, {myHours} giờ
        </span>
        <div className="flex border border-[#E4E6E9] rounded-md overflow-hidden">
          {[
            { value: false, label: "Cả nhóm" },
            { value: true, label: "Chỉ ca của tôi" },
          ].map((o, i) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={onlyMine === o.value}
              onClick={() => setOnlyMine(o.value)}
              className={`h-7 px-3 text-[12px] ${i > 0 ? "border-l border-[#E4E6E9]" : ""} ${
                onlyMine === o.value
                  ? "bg-[#1B3A5C] text-white font-medium"
                  : "bg-white text-[#5C6672] hover:bg-[#F5F6F7]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </WeekNavigator>

      <div className="relative">
        <LoadingBar active={loadingSchedule} />
        {firstLoad ? (
          <div className="py-16 text-center text-[13px] text-[#98A1AC]">
            Đang tải lịch làm việc
          </div>
        ) : (
          <div
            className={`transition-opacity ${loadingSchedule ? "opacity-50" : ""}`}
          >
            <ShiftGrid
              shifts={shifts}
              days={days}
              cells={cells}
              today={today}
              readOnly
              highlightId={employeeId ?? undefined}
            />
          </div>
        )}
      </div>

      <div className="px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[#E4E6E9] text-[11.5px] text-[#5C6672]">
        {shifts.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1.5 tabular-nums"
          >
            <span
              className="w-[9px] h-[9px] rounded-sm"
              style={{ background: SHIFT_COLOR[s.name] }}
            />
            {SHIFT_LABELS[s.name]} {s.start_time} – {s.end_time}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-[9px] h-[9px] rounded-sm bg-[#FFF9EC] border border-[#C9A84C]" />
          Ca của bạn
        </span>
      </div>
    </div>
  );
}
