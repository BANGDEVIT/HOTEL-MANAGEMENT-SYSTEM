import HoverCard from "../../../components/HoverCard";
import { STATUS_COLOR, STATUS_LABELS } from "../../../types/room";

export interface RoomTypeStats {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
}

const SEGMENTS = ["available", "occupied", "cleaning", "maintenance"] as const;

export default function OccupancyBar({ stats }: { stats?: RoomTypeStats }) {
  if (!stats || stats.total === 0) {
    return (
      <div>
        <span className="text-[12px] text-ink-muted">Chưa có phòng</span>
        <div className="h-1.5 mt-1.5 rounded-full bg-table-head" />
      </div>
    );
  }

  const percent = (n: number) => Math.round((n / stats.total) * 100);

  const detail = (
    <div className="tabular-nums">
      <p className="text-[12px] font-medium text-ink mb-2">
        Tình trạng {stats.total} phòng
      </p>

      {/* Thanh lớn hơn trong khung, dễ nhìn tỉ lệ */}
      <div className="flex h-2 rounded-full overflow-hidden bg-table-head mb-2.5">
        {SEGMENTS.map((key) =>
          stats[key] > 0 ? (
            <span
              key={key}
              style={{
                width: `${percent(stats[key])}%`,
                background: STATUS_COLOR[key],
              }}
            />
          ) : null,
        )}
      </div>

      <div className="space-y-1.5">
        {SEGMENTS.map((key) => {
          const n = stats[key];
          const empty = n === 0;
          return (
            <div
              key={key}
              className="grid items-center gap-2 text-[12px]"
              style={{ gridTemplateColumns: "8px 1fr 24px 36px" }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: empty ? "#E4E6E9" : STATUS_COLOR[key] }}
              />
              <span className={empty ? "text-ink-muted" : "text-ink-secondary"}>
                {STATUS_LABELS[key]}
              </span>
              <span
                className={`text-right ${empty ? "text-ink-muted" : "text-ink"}`}
              >
                {n}
              </span>
              <span className="text-right text-ink-muted">
                {empty ? "—" : `${percent(n)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <HoverCard
      content={detail}
      width={200}
      className="cursor-default"
    >
      <span className="text-[12px] text-ink-secondary tabular-nums">
        <b className="font-medium text-ink">{stats.total}</b> phòng,{" "}
        {stats.available} trống
      </span>
      <div className="flex h-1.5 mt-1.5 rounded-full overflow-hidden bg-table-head">
        {SEGMENTS.map((key) =>
          stats[key] > 0 ? (
            <span
              key={key}
              style={{
                width: `${(stats[key] / stats.total) * 100}%`,
                background: STATUS_COLOR[key],
              }}
            />
          ) : null,
        )}
      </div>
    </HoverCard>
  );
}
