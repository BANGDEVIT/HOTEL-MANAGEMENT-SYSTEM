import { BarChart3, CircleCheck, Star, Wallet, type LucideIcon } from "lucide-react";
import { useServiceStore } from "../store/serviceStore";
import {
  formatMoneyShort,
  formatNumber,
  formatQty,
  percentChange,
} from "../utils/serviceMeta";

interface Card {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  value: React.ReactNode;
  note: React.ReactNode;
}

const monthLabel = () =>
  new Date().toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "numeric",
  });

/**
 * 4 ô số liệu lấy từ /services/stats: số của CẢ danh mục, lọc bảng thế nào cũng không đổi.
 * Ô "Đang bán" bấm được: lọc nhanh chỉ dịch vụ đang bán.
 */
export default function ServiceStatsCards() {
  const stats = useServiceStore((s) => s.stats);
  const status = useServiceStore((s) => s.filters.status);
  const setFilters = useServiceStore((s) => s.setFilters);

  const change = stats
    ? percentChange(stats.revenue_this_month, stats.revenue_last_month)
    : null;
  const top = stats?.top[0];

  const cards: Card[] = [
    {
      key: "active",
      label: "Đang bán",
      icon: CircleCheck,
      tint: "var(--color-room-available)",
      value: stats ? (
        <>
          {stats.active}
          <span className="text-[14px] font-medium text-ink-faint">
            {" "}
            / {stats.total}
          </span>
        </>
      ) : (
        "–"
      ),
      note: stats ? `${stats.total - stats.active} dịch vụ đã ngừng bán` : " ",
    },
    {
      key: "revenue",
      label: `Doanh thu dịch vụ tháng ${monthLabel()}`,
      icon: Wallet,
      tint: "var(--color-gold-700)",
      value: stats ? formatMoneyShort(stats.revenue_this_month) : "–",
      note:
        change === null ? (
          "tháng trước chưa có doanh thu"
        ) : (
          <span
            style={{
              color:
                change >= 0
                  ? "var(--color-room-available)"
                  : "var(--color-room-occupied)",
            }}
          >
            {change >= 0 ? "+" : ""}
            {change}% so với tháng trước
          </span>
        ),
    },
    {
      key: "uses",
      label: "Lượt gọi dịch vụ 30 ngày",
      icon: BarChart3,
      tint: "var(--color-navy-700)",
      value: stats ? formatNumber(stats.uses_30d) : "–",
      note: "mỗi lần lễ tân thêm dịch vụ là 1 lượt",
    },
    {
      key: "top",
      label: "Doanh thu cao nhất 30 ngày",
      icon: Star,
      tint: "var(--color-shift-night)",
      value: top ? (
        <span className="block truncate text-[17px]">{top.name}</span>
      ) : (
        "–"
      ),
      note: top
        ? `${formatQty(top.usage_30d, top.unit)} · ${formatMoneyShort(top.revenue_30d)}`
        : "chưa có dữ liệu",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {cards.map(({ key, label, icon: Icon, tint, value, note }) => {
        const body = (
          <>
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
                <span className="block text-[24px] font-bold leading-tight tabular-nums text-ink">
                  {value}
                </span>
              </span>
            </span>
            <span className="mt-3 block truncate border-t border-line-soft pt-2 text-[11.5px] text-ink-faint">
              {note}
            </span>
          </>
        );
        const base = "min-w-0 rounded-[16px] border bg-white px-4 py-3.5 text-left";

        if (key !== "active") {
          return (
            <div
              key={key}
              className={`${base} border-line`}
            >
              {body}
            </div>
          );
        }
        const on = status === "active";
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => setFilters({ status: on ? "all" : "active" })}
            className={`${base} transition-colors ${
              on
                ? "border-navy-700 shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
                : "border-line hover:border-line-input"
            }`}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
