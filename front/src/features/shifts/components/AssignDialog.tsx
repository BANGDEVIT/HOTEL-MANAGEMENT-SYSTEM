import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Shift } from "../../../types/shift";
import { SHIFT_LABELS, SHIFT_REQUIRED } from "../../../types/shift";
import { useShiftStore } from "../store/shiftStore";
import { DAY_LABELS, dayMonth, fromYmd } from "../utils/week";
import { EmployeeAvatar } from "./EmployeeChip";

export interface AssignTarget {
  shift: Shift;
  day: string;
}

interface Props {
  target: AssignTarget | null;
  onClose: () => void;
}

/**
 * Lớp vỏ: chỉ lo mở/đóng.
 * Thân dialog có key theo ô -> mở ô khác là React tạo thân MỚI,
 * ô tìm kiếm và danh sách đã chọn tự về trống, khỏi cần useEffect để reset.
 */
export default function AssignDialog({ target, onClose }: Props) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="p-0 gap-0 sm:max-w-[480px] overflow-hidden">
        {target && (
          <AssignBody
            key={`${target.shift.id}|${target.day}`}
            target={target}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Bỏ dấu để gõ "dat" ra "Đạt", "lan" ra "Lân" */
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

type Status =
  | { kind: "free" }
  | { kind: "here" }
  | { kind: "busy"; shiftLabel: string };
const FREE: Status = { kind: "free" };
const ORDER: Record<Status["kind"], number> = { free: 0, here: 1, busy: 2 };

function AssignBody({
  target,
  onClose,
}: {
  target: AssignTarget;
  onClose: () => void;
}) {
  const employees = useShiftStore((s) => s.employees);
  const schedule = useShiftStore((s) => s.schedule);
  const assign = useShiftStore((s) => s.assign);

  const { shift, day } = target;

  const [query, setQuery] = useState("");
  // Hàm khởi tạo () => new Set(): chỉ chạy 1 lần lúc mount, không tạo Set thừa mỗi render
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  /**
   * Ai đã có lịch trong NGÀY này.
   * Khớp đúng quy tắc @@unique([employee_id, work_date]) bên BE:
   * FE chặn trước thay vì để người dùng chọn rồi mới nhận 409.
   */
  const statusById = useMemo(() => {
    const map = new Map<string, Status>();
    for (const item of schedule) {
      if (item.work_date !== day) continue;
      map.set(
        item.employee.id,
        item.shift.id === shift.id
          ? { kind: "here" }
          : { kind: "busy", shiftLabel: SHIFT_LABELS[item.shift.name] },
      );
    }
    return map;
  }, [schedule, day, shift.id]);

  const inShift = [...statusById.values()].filter((s) => s.kind === "here").length;
  const stillMissing = Math.max(0, SHIFT_REQUIRED[shift.name] - inShift);

  const list = useMemo(() => {
    const q = normalize(query.trim());
    return (
      employees
        .filter((e) => !q || normalize(`${e.full_name} ${e.position}`).includes(q))
        .map((e) => ({ employee: e, status: statusById.get(e.id) ?? FREE }))
        // Người chọn được lên đầu, rồi tới người đã trong ca, cuối cùng là người bận ca khác
        .sort(
          (a, b) =>
            ORDER[a.status.kind] - ORDER[b.status.kind] ||
            a.employee.full_name.localeCompare(b.employee.full_name, "vi"),
        )
    );
  }, [employees, query, statusById]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      // PHẢI tạo Set mới. Sửa thẳng prev.add(id) rồi trả prev
      // -> vẫn là tham chiếu cũ -> React coi như không đổi -> không render lại
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await assign(shift.id, day, [...selected]);
      toast.success(
        `Đã xếp ${res.total_assigned} người vào ${SHIFT_LABELS[shift.name].toLowerCase()} ngày ${dayMonth(day)}`,
      );
      onClose();
    } catch {
      // Store đã toast lỗi. Giữ dialog mở để người dùng chọn lại.
    } finally {
      setSubmitting(false);
    }
  };

  const dayName = DAY_LABELS[(fromYmd(day).getDay() + 6) % 7];

  return (
    <>
      <div className="px-5 pt-5 pb-3 border-b border-line">
        <DialogTitle className="text-[16px] font-semibold text-ink">
          {SHIFT_LABELS[shift.name]}, {dayName.toLowerCase()} {dayMonth(day)}
        </DialogTitle>
        <DialogDescription className="text-[12px] text-ink-secondary mt-1 tabular-nums">
          {shift.start_time} – {shift.end_time}
          {shift.is_overnight && " hôm sau"}, cần {SHIFT_REQUIRED[shift.name]} người,
          đang có {inShift}
        </DialogDescription>

        <div className="relative mt-3">
          <Search
            size={14}
            strokeWidth={1.75}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc vị trí"
            autoFocus
            className="w-full h-8 pl-8 pr-3 rounded-md border border-line text-[13px] outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#C9A84C]/40"
          />
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto">
        {list.length === 0 && (
          <div className="py-10 text-center text-[12px] text-ink-muted">
            Không tìm thấy nhân viên phù hợp
          </div>
        )}

        {list.map(({ employee: e, status }) => {
          const disabled = status.kind !== "free";
          return (
            // <label> bọc cả dòng -> bấm vào tên cũng tick được checkbox
            <label
              key={e.id}
              className={`flex items-center gap-3 px-5 h-[52px] border-b border-line-soft ${
                disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-row-hover"
              }`}
            >
              <input
                type="checkbox"
                checked={status.kind === "here" || selected.has(e.id)}
                disabled={disabled}
                onChange={() => toggle(e.id)}
                className="w-4 h-4 accent-[#1B3A5C]"
              />
              <EmployeeAvatar
                name={e.full_name}
                url={e.avatar_url}
                size={28}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] truncate ${disabled ? "text-ink-muted" : "text-ink"}`}
                >
                  {e.full_name}
                </div>
                <div className="text-[11px] text-ink-muted truncate">
                  {e.position}
                </div>
              </div>
              {status.kind === "here" && (
                <span className="text-[11px] text-[#0E7C5A] shrink-0">
                  Đã trong ca
                </span>
              )}
              {status.kind === "busy" && (
                <span className="text-[11px] text-ink-muted shrink-0">
                  Đang có {status.shiftLabel.toLowerCase()}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="px-5 py-3 flex items-center gap-2 border-t border-line bg-table-head">
        <span className="flex-1 text-[12px] text-ink-secondary tabular-nums">
          {selected.size > 0
            ? `Đã chọn ${selected.size} người`
            : stillMissing > 0
              ? `Ca còn thiếu ${stillMissing} người`
              : "Ca đã đủ người"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-3.5 rounded-md border border-line bg-white text-[13px] text-ink hover:bg-row-hover"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={selected.size === 0 || submitting}
          className="h-8 px-3.5 rounded-md bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Đang xếp" : "Xếp ca"}
        </button>
      </div>
    </>
  );
}
