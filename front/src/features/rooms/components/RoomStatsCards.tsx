import {
  BedDouble,
  Sparkles,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { RoomStatus } from "../../../types/room";
import { STATUS_COLOR } from "../../../types/room";
import { useRoomStore } from "../stores/room.store";

/**
 * 4 ô thống kê. Thay cho RoomTally cũ.
 * Số lấy từ /rooms/stats -> luôn là số của CẢ khách sạn, lọc thế nào cũng không đổi.
 * Bấm vào ô = lọc theo trạng thái đó, bấm lần nữa = bỏ lọc.
 */

const CARDS: {
  status: Exclude<RoomStatus, "inactive">;
  label: string;
  icon: LucideIcon;
}[] = [
  { status: "available", label: "Trống", icon: BedDouble },
  { status: "occupied", label: "Có khách", icon: UserRound },
  { status: "cleaning", label: "Đang dọn", icon: Sparkles },
  { status: "maintenance", label: "Bảo trì", icon: Wrench },
];

export default function RoomStatsCards() {
  const stats = useRoomStore((s) => s.stats);
  const activeStatus = useRoomStore((s) => s.filters.status);
  const setFilters = useRoomStore((s) => s.setFilters);

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {CARDS.map(({ status, label, icon: Icon }) => {
        const count = stats?.[status] ?? 0;
        const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0;
        const color = STATUS_COLOR[status];
        const active = activeStatus === status;

        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            // Nếu store của bạn dùng 'all' thay cho undefined thì đổi ở đây (xem RoomToolbar)
            onClick={() =>
              setFilters({ status: active ? undefined : status, page: 1 })
            }
            className={`rounded-[16px] border bg-white px-4 py-3.5 text-left transition-colors ${
              active
                ? "border-navy-700 shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
                : "border-line hover:border-line-input"
            }`}
          >
            <span className="flex items-start justify-between">
              <span>
                <span className="block text-[12.5px] text-ink-secondary">
                  {label}
                </span>
                <span className="mt-0.5 block text-[26px] font-bold tabular-nums text-ink">
                  {stats ? count : "–"}
                </span>
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-[9px]"
                // color-mix: pha 10% màu trạng thái với trong suốt -> nền nhạt cùng tông
                style={{
                  color,
                  background: `color-mix(in srgb, ${color} 10%, transparent)`,
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
            </span>

            <span className="mt-2.5 flex items-center gap-2.5">
              <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-line-soft">
                <span
                  className="block h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${pct}%`, background: color }}
                />
              </span>
              <span className="w-8 text-right text-[11.5px] tabular-nums text-ink-faint">
                {pct}%
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
