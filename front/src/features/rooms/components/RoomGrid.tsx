import { useMemo, useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import type { Room } from "../../../types/room";
import { groupByFloor } from "../utils/GroupByFloor";
import RoomCard from "./RoomCard";

interface Props {
  rooms: Room[]; // đã lọc sẵn theo tầng ở trang cha
  onEdit: (room: Room) => void;
  onManageImages: (room: Room) => void;
}

export default function RoomGrid({ rooms, onEdit, onManageImages }: Props) {
  const groups = useMemo(() => groupByFloor(rooms), [rooms]);

  // Các tầng đang thu gọn. State riêng của lưới: trang cha không cần biết
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const toggle = (floor: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev); // PHẢI tạo Set mới, sửa Set cũ thì React không render lại
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });

  if (groups.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[14px] font-medium text-ink">Không có phòng phù hợp</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Thử bỏ bớt bộ lọc hoặc chọn tầng khác.
        </p>
      </div>
    );
  }

  return (
    <div>
      {groups.map((g) => (
        <FloorSection
          key={g.floor}
          floor={g.floor}
          rooms={g.rooms}
          collapsed={collapsed.has(g.floor)}
          onToggle={() => toggle(g.floor)}
        >
          {g.rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={onEdit}
              onManageImages={onManageImages}
            />
          ))}
        </FloorSection>
      ))}
    </div>
  );
}

/* Khai báo ở cấp ngoài cùng file, không đặt bên trong RoomGrid */
function FloorSection({
  floor,
  rooms,
  collapsed,
  onToggle,
  children,
}: {
  floor: number;
  rooms: Room[];
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const vacant = rooms.filter((r) => r.status === "available").length;
  const bodyId = `floor-${floor}-rooms`;

  return (
    <section
      aria-labelledby={`floor-${floor}-title`}
      className="border-t border-line-soft px-4 pb-2 pt-4 first:border-t-0"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <h2
          id={`floor-${floor}-title`}
          className="text-[15px] font-bold text-navy-900"
        >
          Tầng {floor}
        </h2>
        <span className="text-[12px] tabular-nums text-ink-muted">
          {rooms.length} phòng, {vacant} trống
        </span>
        <span className="h-px flex-1 bg-line-soft" />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? `Mở tầng ${floor}` : `Thu gọn tầng ${floor}`}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-muted hover:bg-segment"
        >
          <ChevronUp
            size={15}
            strokeWidth={2}
            className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div
          id={bodyId}
          className="grid gap-3.5 pb-2 [grid-template-columns:repeat(auto-fill,minmax(212px,1fr))]"
        >
          {children}
        </div>
      )}
    </section>
  );
}
