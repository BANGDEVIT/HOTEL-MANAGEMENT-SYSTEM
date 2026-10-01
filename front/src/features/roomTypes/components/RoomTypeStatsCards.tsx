import { useMemo } from "react";
import {
  BedDouble,
  CircleCheck,
  LineChart,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useRoomTypeStore } from "../store/roomTypeStore";
import { formatMoney, formatMoneyShort, summarize } from "../utils/roomTypeMeta";

interface Card {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  value: React.ReactNode;
  note: string;
  title?: string;
}

/** 4 ô số liệu tính thẳng từ danh sách loại phòng: không cần API thống kê riêng */
export default function RoomTypeStatsCards() {
  const items = useRoomTypeStore((s) => s.items);
  const lastUpdated = useRoomTypeStore((s) => s.lastUpdated);
  const sum = useMemo(() => summarize(items), [items]);
  const ready = lastUpdated !== null;

  const cards: Card[] = [
    {
      key: "active",
      label: "Đang kinh doanh",
      icon: CircleCheck,
      tint: "var(--color-room-available)",
      value: ready ? (
        <>
          {sum.active}
          <span className="text-[14px] font-medium text-ink-faint">
            {" "}
            / {sum.total} loại
          </span>
        </>
      ) : (
        "–"
      ),
      note: ready
        ? sum.total - sum.active
          ? `${sum.total - sum.active} loại tạm ngừng`
          : "Mọi loại đều đang bán"
        : " ",
    },
    {
      key: "rooms",
      label: "Tổng số phòng",
      icon: BedDouble,
      tint: "var(--color-navy-600)",
      value: ready ? sum.rooms.total : "–",
      note: ready
        ? `${sum.rooms.available} trống · ${sum.rooms.occupied} có khách · ${sum.rooms.off} bảo trì / ngừng`
        : " ",
    },
    {
      key: "price",
      label: "Giá 1 đêm",
      icon: Wallet,
      tint: "var(--color-gold-700)",
      value:
        ready && sum.active
          ? `${formatMoneyShort(sum.minPrice)} – ${formatMoneyShort(sum.maxPrice)}`
          : "–",
      note:
        ready && sum.active
          ? `trung bình ${formatMoneyShort(sum.avgPrice)} / đêm`
          : " ",
    },
    {
      key: "revenue",
      label: "Doanh thu phòng 30 ngày",
      icon: LineChart,
      tint: "var(--color-shift-night)",
      value: ready ? formatMoneyShort(sum.revenue) : "–",
      title: ready ? formatMoney(sum.revenue) : undefined,
      note: sum.top
        ? `cao nhất: ${sum.top.name} ${formatMoneyShort(sum.top.revenue_30d)}`
        : "chưa có doanh thu",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {cards.map(({ key, label, icon: Icon, tint, value, note, title }) => (
        <div
          key={key}
          className="min-w-0 rounded-[16px] border border-line bg-white px-4 py-3.5"
        >
          <span className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
              style={{
                color: tint,
                background: `color-mix(in srgb, ${tint} 10%, transparent)`,
              }}
            >
              <Icon
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-ink-secondary">
                {label}
              </span>
              <span
                className="block truncate text-[24px] font-bold leading-tight tabular-nums text-ink"
                title={title}
              >
                {value}
              </span>
            </span>
          </span>
          <span className="mt-3 block truncate border-t border-line-soft pt-2 text-[11.5px] text-ink-faint">
            {note}
          </span>
        </div>
      ))}
    </div>
  );
}
