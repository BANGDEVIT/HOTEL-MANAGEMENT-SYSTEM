import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import LoadingBar from "../../components/LoadingBar";
import type { ScheduleItem, Shift } from "../../types/shift";
import { SHIFT_COLOR, SHIFT_LABELS } from "../../types/shift";
import { useShiftStore } from "./store/shiftStore";
import { buildStaffRows, computeTally, groupByCell } from "./utils/schedule";
import { dayMonth, mondayOf, todayYmd, weekDays } from "./utils/week";
import WeekNavigator, { type ShiftView } from "./components/WeekNavigator";
import ShiftTally from "./components/ShiftTally";
import ShiftGrid from "./components/ShiftGrid";
import StaffGrid from "./components/StaffGrid";
import AssignDialog, { type AssignTarget } from "./components/AssignDialog";
import ShiftCatalogDialog from "./components/ShiftCatalogDialog";

export default function ShiftManagement() {
  // Lấy TỪNG field bằng selector riêng: trang chỉ render lại khi đúng field đó đổi.
  // Viết const { ... } = useShiftStore() thì field nào trong store đổi cũng render lại.
  const weekStart = useShiftStore((s) => s.weekStart);
  const shifts = useShiftStore((s) => s.shifts);
  const schedule = useShiftStore((s) => s.schedule);
  const employees = useShiftStore((s) => s.employees);
  const loadingSchedule = useShiftStore((s) => s.loadingSchedule);
  const lastUpdated = useShiftStore((s) => s.lastUpdated);

  const fetchShifts = useShiftStore((s) => s.fetchShifts);
  const fetchEmployees = useShiftStore((s) => s.fetchEmployees);
  const fetchSchedule = useShiftStore((s) => s.fetchSchedule);
  const prevWeek = useShiftStore((s) => s.prevWeek);
  const nextWeek = useShiftStore((s) => s.nextWeek);
  const thisWeek = useShiftStore((s) => s.thisWeek);
  const unassign = useShiftStore((s) => s.unassign);

  // State chỉ trang này dùng -> để ở trang, không đưa vào store
  const [view, setView] = useState<ShiftView>("grid");
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    // 3 request độc lập -> gọi song song, không await nối đuôi nhau
    fetchShifts();
    fetchEmployees();
    fetchSchedule();
    // Action của Zustand không bao giờ đổi tham chiếu -> effect chỉ chạy 1 lần,
    // mà vẫn khai báo đủ dependency nên ESLint không cảnh báo
  }, [fetchShifts, fetchEmployees, fetchSchedule]);

  const today = todayYmd();

  /* ---- Tính ra từ dữ liệu thô. useMemo: chỉ tính lại khi đầu vào đổi ---- */
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const cells = useMemo(() => groupByCell(schedule), [schedule]);
  const tally = useMemo(
    () => computeTally(shifts, days, cells),
    [shifts, days, cells],
  );
  const staffRows = useMemo(
    () => buildStaffRows(schedule, days, employees),
    [schedule, days, employees],
  );

  const handleAdd = (shift: Shift, day: string) => setAssignTarget({ shift, day });

  const handleRemove = async (item: ScheduleItem) => {
    // Lỗi: store đã toast + ném tiếp -> EmployeeChip bắt. Tới dòng dưới nghĩa là thành công.
    await unassign(item);
    toast.success(
      `Đã gỡ ${item.employee.full_name} khỏi ${SHIFT_LABELS[item.shift.name].toLowerCase()} ${dayMonth(item.work_date)}`,
    );
  };

  // Chưa tải xong lần nào -> KHÔNG vẽ lưới, vì lưới rỗng sẽ hiện toàn ô đỏ "thiếu người"
  const firstLoad = lastUpdated === null;

  return (
    <div>
      <div className="bg-white border border-line rounded-[10px] overflow-hidden">
        {/* ===== Header ===== */}
        <div className="px-5 py-4 flex items-start justify-between border-b border-line">
          <div>
            <h1 className="text-[19px] font-semibold text-ink tracking-[-0.01em]">
              Ca làm việc
            </h1>
            <p className="text-[12px] text-ink-muted mt-0.5 tabular-nums">
              {shifts.length} ca mỗi ngày
              {lastUpdated &&
                `, cập nhật ${lastUpdated.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="h-[34px] px-3.5 rounded-md border border-line text-[13px] text-ink hover:bg-row-hover flex items-center gap-2"
          >
            <Clock
              size={14}
              strokeWidth={1.75}
              className="text-ink-secondary"
            />
            Danh mục ca
          </button>
        </div>

        <WeekNavigator
          weekStart={weekStart}
          isCurrentWeek={weekStart === mondayOf(today)}
          onPrev={prevWeek}
          onNext={nextWeek}
          onToday={thisWeek}
          view={view}
          onViewChange={setView}
        />

        {!firstLoad && <ShiftTally tally={tally} />}

        {/* ===== Nội dung: relative để LoadingBar bám mép trên ===== */}
        <div className="relative">
          <LoadingBar active={loadingSchedule} />

          {firstLoad ? (
            <div className="py-16 text-center text-[13px] text-ink-muted">
              Đang tải lịch làm việc
            </div>
          ) : (
            // Đang tải tuần mới: GIỮ lịch cũ, làm mờ và khoá bấm cho tới khi dữ liệu về
            <div
              className={`transition-opacity ${loadingSchedule ? "opacity-50 pointer-events-none" : ""}`}
            >
              {view === "grid" ? (
                <ShiftGrid
                  shifts={shifts}
                  days={days}
                  cells={cells}
                  today={today}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                />
              ) : (
                <StaffGrid
                  rows={staffRows}
                  days={days}
                  today={today}
                />
              )}
            </div>
          )}
        </div>

        {/* ===== Chú thích ===== */}
        <div className="px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line text-[11.5px] text-ink-secondary">
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
            <span className="w-[9px] h-[9px] rounded-sm bg-[#FDF4F2] border border-[#F0D5CF]" />
            Ô chưa đủ người
          </span>
        </div>
      </div>

      <AssignDialog
        target={assignTarget}
        onClose={() => setAssignTarget(null)}
      />
      <ShiftCatalogDialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
      />
    </div>
  );
}
