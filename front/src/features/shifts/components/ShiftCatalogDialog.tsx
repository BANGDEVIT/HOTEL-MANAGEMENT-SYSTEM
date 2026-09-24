import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Shift } from "../../../types/shift";
import { SHIFT_COLOR, SHIFT_LABELS } from "../../../types/shift";
import { useShiftStore } from "../store/shiftStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShiftCatalogDialog({ open, onClose }: Props) {
  const shifts = useShiftStore((s) => s.shifts);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent className="p-0 gap-0 sm:max-w-[540px] overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-[#E4E6E9]">
          <DialogTitle className="text-[16px] font-semibold text-[#14181D]">
            Danh mục ca
          </DialogTitle>
          <DialogDescription className="text-[12px] text-[#5C6672] mt-1">
            Giờ kết thúc nhỏ hơn giờ bắt đầu nghĩa là ca kéo qua nửa đêm.
          </DialogDescription>
        </div>

        {shifts.map((s) => (
          // key có cả giờ: lưu xong -> store đổi giờ -> key đổi
          // -> React tạo lại dòng với giá trị mới, khỏi phải tự reset state
          <ShiftTimeRow
            key={`${s.id}|${s.start_time}|${s.end_time}`}
            shift={s}
          />
        ))}

        <p className="px-5 py-3 text-[11.5px] leading-relaxed text-[#98A1AC] bg-[#F5F6F7]">
          Giờ mới áp dụng cho mọi lịch đã xếp, kể cả các tuần đã qua, vì lịch chỉ lưu
          ca nào chứ không lưu giờ lúc xếp.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ShiftTimeRow({ shift }: { shift: Shift }) {
  const updateShift = useShiftStore((s) => s.updateShift);

  const [start, setStart] = useState(shift.start_time);
  const [end, setEnd] = useState(shift.end_time);
  const [saving, setSaving] = useState(false);

  const changed = start !== shift.start_time || end !== shift.end_time;
  const invalid = !start || !end || start === end;
  const overnight = !invalid && end < start;

  const save = async () => {
    setSaving(true);
    try {
      // Chỉ gửi field thực sự đổi
      await updateShift(shift.id, {
        ...(start !== shift.start_time && { start_time: start }),
        ...(end !== shift.end_time && { end_time: end }),
      });
      toast.success(`Đã cập nhật giờ ${SHIFT_LABELS[shift.name].toLowerCase()}`);
    } catch {
      // store đã báo lỗi
    } finally {
      setSaving(false);
    }
  };

  const timeInput =
    "h-8 w-[92px] px-2 rounded-md border border-[#E4E6E9] text-[13px] tabular-nums outline-none focus:border-[#1B3A5C] focus:ring-2 focus:ring-[#C9A84C]/40";

  return (
    <div className="px-5 py-3 flex items-center gap-3 border-b border-[#F0F1F3]">
      <span
        className="w-[3px] h-8 rounded-full shrink-0"
        style={{ background: SHIFT_COLOR[shift.name] }}
      />

      <div className="w-[76px] shrink-0 text-[13px] font-semibold text-[#14181D]">
        {SHIFT_LABELS[shift.name]}
      </div>

      <input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        aria-label="Giờ bắt đầu"
        className={timeInput}
      />
      <span className="text-[12px] text-[#98A1AC]">đến</span>
      <input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        aria-label="Giờ kết thúc"
        className={timeInput}
      />

      <div className="flex-1 text-[11px]">
        {invalid && <span className="text-[#B4321F]">Giờ trùng nhau</span>}
        {overnight && <span className="text-[#5C6672]">Qua đêm</span>}
      </div>

      {changed && (
        <button
          type="button"
          onClick={() => {
            setStart(shift.start_time);
            setEnd(shift.end_time);
          }}
          className="text-[12px] text-[#5C6672] hover:text-[#14181D]"
        >
          Hoàn tác
        </button>
      )}
      <button
        type="button"
        onClick={save}
        disabled={!changed || invalid || saving}
        className="h-8 px-3 rounded-md bg-[#1B3A5C] text-white text-[12px] font-medium hover:bg-[#0F2440] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Đang lưu" : "Lưu"}
      </button>
    </div>
  );
}
