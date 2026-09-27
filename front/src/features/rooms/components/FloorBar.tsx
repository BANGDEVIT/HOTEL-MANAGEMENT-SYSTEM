import type { FloorStats, RoomStatus } from "../../../types/room";
import { STATUS_COLOR } from "../../../types/room";

export type FloorValue = number | "all";

type Counts = Omit<FloorStats, "floor">;

const MIX: Exclude<RoomStatus, "inactive">[] = [
  "available",
  "occupied",
  "cleaning",
  "maintenance",
];

interface Props {
  floors: FloorStats[]; // lấy từ /rooms/stats -> KHÔNG đổi khi lọc trạng thái
  selected: FloorValue;
  onSelect: (floor: FloorValue) => void;
}

export default function FloorBar({ floors, selected, onSelect }: Props) {
  // Ô "Tất cả tầng" = cộng dồn mọi tầng
  const all = floors.reduce<Counts>(
    (acc, f) => ({
      total: acc.total + f.total,
      available: acc.available + f.available,
      occupied: acc.occupied + f.occupied,
      cleaning: acc.cleaning + f.cleaning,
      maintenance: acc.maintenance + f.maintenance,
    }),
    { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 },
  );

  return (
    <div
      role="group"
      aria-label="Chọn tầng"
      className="flex gap-2 overflow-x-auto border-b border-line-soft bg-table-head px-4 py-3"
    >
      <FloorChip
        label="Tất cả tầng"
        counts={all}
        active={selected === "all"}
        onClick={() => onSelect("all")}
      />
      {floors.map((f) => (
        <FloorChip
          key={f.floor}
          label={`Tầng ${f.floor}`}
          counts={f}
          active={selected === f.floor}
          onClick={() => onSelect(f.floor)}
        />
      ))}
    </div>
  );
}

function FloorChip({
  label,
  counts,
  active,
  onClick,
}: {
  label: string;
  counts: Counts;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-[116px] shrink-0 rounded-[12px] border bg-white px-3 py-2 text-left transition-colors ${
        active
          ? "border-navy-700 shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
          : "border-line hover:border-line-input"
      }`}
    >
      <span className="flex items-center justify-between gap-3 text-[12.5px] font-semibold text-ink">
        {label}
        <span className="font-normal tabular-nums text-ink-faint">
          {counts.total}
        </span>
      </span>

      {/* Thanh tỉ lệ trạng thái: mỗi đoạn dài theo số phòng của trạng thái đó */}
      <span
        className="mt-2 flex h-1 overflow-hidden rounded-full bg-line-soft"
        aria-hidden="true"
      >
        {counts.total > 0 &&
          MIX.map((s) =>
            counts[s] > 0 ? (
              <span
                key={s}
                style={{
                  width: `${(counts[s] / counts.total) * 100}%`,
                  background: STATUS_COLOR[s],
                }}
              />
            ) : null,
          )}
      </span>

      <span className="mt-1.5 block text-[11px] tabular-nums text-ink-muted">
        {counts.available} phòng trống
      </span>
    </button>
  );
}
