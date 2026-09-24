import type { RoomStatus } from "../../../types/room";
import { STATUS_COLOR } from "../../../types/room";
import { useRoomStore } from "../stores/room.store";

// 4 trạng thái hiện trên thanh. "Đã ẩn" không hiện vì không phải phòng đang kinh doanh.
const TALLY: { status: RoomStatus; label: string }[] = [
  { status: "available", label: "trống" },
  { status: "occupied", label: "có khách" },
  { status: "cleaning", label: "đang dọn" },
  { status: "maintenance", label: "bảo trì" },
];

export default function RoomTally() {
  const stats = useRoomStore((s) => s.stats);
  const activeStatus = useRoomStore((s) => s.filters.status);
  const setFilters = useRoomStore((s) => s.setFilters);

  return (
    <div className="grid grid-cols-4 border-b border-[#E4E6E9]">
      {TALLY.map(({ status, label }, i) => {
        const active = activeStatus === status;
        return (
          <button
            key={status}
            type="button"
            // Bấm ô đang chọn lần nữa thì bỏ lọc
            onClick={() => setFilters({ status: status, page: 1 })}
            className={`px-5 py-3.5 flex items-baseline gap-2 text-left transition-colors ${
              i > 0 ? "border-l border-[#E4E6E9]" : ""
            } ${active ? "bg-[#F5F6F7]" : "hover:bg-[#FAFBFB]"}`}
          >
            <span
              className="w-[7px] h-[7px] rounded-full self-center"
              style={{ background: STATUS_COLOR[status] }}
            />
            <span className="text-[19px] font-semibold text-[#14181D] tabular-nums">
              {/* Chưa tải xong thì hiện "–", không hiện 0 kẻo người dùng tưởng thật */}
              {stats ? stats[status] : "–"}
            </span>
            <span className="text-[12px] text-[#5C6672]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
