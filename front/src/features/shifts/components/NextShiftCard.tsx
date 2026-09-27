import { useEffect, useState } from "react";
import type { NextShift } from "../../../types/shift";
import { SHIFT_COLOR, SHIFT_LABELS } from "../../../types/shift";
import { formatDuration, relativeDay } from "../utils/time";
import { todayYmd } from "../utils/week";

/** Trả về giờ hiện tại, tự cập nhật mỗi intervalMs -> component tự render lại để đếm ngược */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t); // rời trang thì dừng hẳn, không chạy ngầm
  }, [intervalMs]);
  return now;
}

interface Props {
  nextShift: NextShift | null;
  loaded: boolean;
  onExpired: () => void; // ca vừa kết thúc -> trang tải ca kế tiếp
}

export default function NextShiftCard({ nextShift, loaded, onExpired }: Props) {
  const now = useNow();

  const startsAt = nextShift ? Date.parse(nextShift.starts_at) : 0;
  const endsAt = nextShift ? Date.parse(nextShift.ends_at) : 0;

  // Gọi onExpired trong effect, KHÔNG gọi trực tiếp khi render:
  // render phải là hàm thuần, không được gây tác dụng phụ như gọi API
  useEffect(() => {
    if (nextShift && now >= endsAt) onExpired();
  }, [now, nextShift, endsAt, onExpired]);

  if (!loaded) {
    return (
      <Frame>
        <span className="text-[13px] text-[#98A1AC]">Đang tải ca tiếp theo</span>
      </Frame>
    );
  }

  if (!nextShift) {
    return (
      <Frame>
        <div>
          <div className="text-[11.5px] text-[#98A1AC]">Ca tiếp theo</div>
          <div className="text-[15px] font-semibold text-[#14181D] mt-0.5">
            Chưa có ca nào sắp tới
          </div>
          <div className="text-[12.5px] text-[#5C6672] mt-0.5">
            Quản lý chưa xếp lịch cho bạn
          </div>
        </div>
      </Frame>
    );
  }

  const { shift, work_date } = nextShift;
  // Tính trạng thái theo giờ HIỆN TẠI, không dùng status lúc tải:
  // để trang mở từ 13:50 thì tới 14:00 tự đổi sang "Đang trong ca"
  const ongoing = now >= startsAt;

  return (
    <Frame color={SHIFT_COLOR[shift.name]}>
      <div className="min-w-0">
        <div
          className={`text-[11.5px] ${ongoing ? "text-[#0E7C5A] font-medium" : "text-[#98A1AC]"}`}
        >
          {ongoing ? "Đang trong ca" : "Ca tiếp theo"}
        </div>
        <div className="text-[22px] font-semibold text-[#14181D] tracking-[-0.01em] mt-0.5">
          {SHIFT_LABELS[shift.name]}, {relativeDay(work_date, todayYmd())}
        </div>
        <div className="text-[13px] text-[#5C6672] mt-0.5 tabular-nums">
          {shift.start_time} – {shift.end_time}
          {shift.is_overnight && " hôm sau"}
        </div>
      </div>

      <div className="ml-auto text-right shrink-0">
        <div className="text-[11.5px] text-[#98A1AC]">
          {ongoing ? "Kết thúc sau" : "Bắt đầu sau"}
        </div>
        <div className="text-[15px] font-semibold text-[#1B3A5C] tabular-nums mt-0.5">
          {formatDuration((ongoing ? endsAt : startsAt) - now)}
        </div>
      </div>
    </Frame>
  );
}

function Frame({
  children,
  color = "#CDD2D8",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="mx-5 my-5 flex border border-[#E4E6E9] rounded-[10px] overflow-hidden">
      <span
        className="w-1 shrink-0"
        style={{ background: color }}
      />
      <div className="flex-1 px-[18px] py-4 flex items-center gap-6 flex-wrap">
        {children}
      </div>
    </div>
  );
}
