/**
 * Biểu đồ cột nhỏ. Mỗi biểu đồ 1 chuỗi số liệu -> 1 màu, không cần chú thích màu.
 * Doanh thu và công suất KHÔNG vẽ chung 1 biểu đồ 2 trục (dễ đọc sai):
 * xếp 2 biểu đồ chồng nhau, dùng chung cột ngày để so từng ngày.
 * Cột bằng div flex (không dùng SVG co giãn) -> chữ không méo; rê chuột / Tab vào cột để xem số.
 */
import { useState } from "react";
import { CalendarRange, History } from "lucide-react";
import type { DashboardOverview } from "../../../types/dashboard";
import {
  dm,
  formatMoney,
  formatMoneyShort,
  weekdayShort,
} from "../utils/dashboardMeta";

interface Bar {
  key: string;
  value: number;
  top: string;
  tip: string;
}

function Bars({
  bars,
  max,
  color,
  height,
  label,
}: {
  bars: Bar[];
  max: number;
  color: string;
  height: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div
      role="img"
      aria-label={label}
      className="flex items-end gap-2"
      style={{ height }}
      onMouseLeave={() => setHover(null)}
    >
      {bars.map((b, i) => {
        const h = b.value ? Math.max(4, (b.value / max) * (height - 18)) : 2;
        return (
          <span
            key={b.key}
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end outline-none"
          >
            <span
              className={`mb-0.5 whitespace-nowrap text-[10.5px] tabular-nums ${hover === i ? "font-semibold text-ink" : "text-ink-faint"}`}
            >
              {b.top}
            </span>
            <span
              className="block w-full rounded-t-[4px] transition-colors"
              style={{
                height: h,
                background: b.value
                  ? hover === i
                    ? "var(--color-gold-500)"
                    : color
                  : "var(--color-segment)",
              }}
            />
            {hover === i && (
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-[7px] bg-navy-900 px-2.5 py-1.5 text-[11.5px] text-white shadow-[0_6px_18px_rgba(20,38,59,.25)]">
                {b.tip}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function Axis({ dates, today }: { dates: string[]; today: string }) {
  return (
    <div
      className="mt-1.5 flex gap-2"
      aria-hidden="true"
    >
      {dates.map((d) => (
        <span
          key={d}
          className={`flex-1 text-center text-[10.5px] tabular-nums ${d === today ? "font-semibold text-ink" : "text-ink-faint"}`}
        >
          {d === today ? "Hôm nay" : `${weekdayShort(d)} ${dm(d)}`}
        </span>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  sub,
  icon: Icon,
  children,
}: {
  title: string;
  sub: string;
  icon: typeof History;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="min-w-0 rounded-[16px] border border-line bg-white px-5 py-4"
    >
      <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
        <Icon
          size={15}
          className="text-ink-faint"
          aria-hidden="true"
        />{" "}
        {title}
      </h2>
      <p className="mb-3 text-[11.5px] text-ink-faint">{sub}</p>
      {children}
    </section>
  );
}

/** 7 ngày qua: thực thu (trên) và công suất (dưới), cùng cột ngày */
export function Past7dChart({ data: d }: { data: DashboardOverview }) {
  const total = d.past_7d.reduce((s, x) => s + x.amount, 0);
  const maxAmount = Math.max(1, ...d.past_7d.map((x) => x.amount));
  return (
    <ChartCard
      title="7 ngày qua"
      sub={`Thực thu ${formatMoney(total)} · công suất từng đêm`}
      icon={History}
    >
      <p className="mb-1 text-[11px] font-medium text-ink-secondary">Thực thu</p>
      <Bars
        label={`Thực thu 7 ngày qua, tổng ${formatMoney(total)}`}
        color="var(--color-navy-700)"
        max={maxAmount}
        height={100}
        bars={d.past_7d.map((x) => ({
          key: x.date,
          value: x.amount,
          top: x.amount ? formatMoneyShort(x.amount) : "",
          tip: `${dm(x.date)}: thu ${formatMoney(x.amount)}`,
        }))}
      />
      <p className="mb-1 mt-3 text-[11px] font-medium text-ink-secondary">
        Công suất
      </p>
      <Bars
        label="Công suất 7 đêm qua"
        color="var(--color-room-available)"
        max={100}
        height={72}
        bars={d.past_7d.map((x) => ({
          key: x.date,
          value: x.occupancy,
          top: `${x.occupancy}%`,
          tip: `${dm(x.date)}: ${x.rooms_sold} phòng có khách (${x.occupancy}%)`,
        }))}
      />
      <Axis
        dates={d.past_7d.map((x) => x.date)}
        today={d.today}
      />
    </ChartCard>
  );
}

/** Công suất dự kiến hôm nay + 6 ngày tới (từ đặt phòng đã có) */
export function Forecast7dChart({ data: d }: { data: DashboardOverview }) {
  return (
    <ChartCard
      title="Công suất 7 ngày tới"
      sub="Theo đặt phòng đã có: chờ duyệt, đã xác nhận, đang ở"
      icon={CalendarRange}
    >
      <Bars
        label="Công suất dự kiến 7 ngày tới"
        color="var(--color-room-available)"
        max={100}
        height={196}
        bars={d.forecast_7d.map((x) => ({
          key: x.date,
          value: x.occupancy,
          top: `${x.occupancy}%`,
          tip: `${dm(x.date)}: ${x.booked} phòng đã đặt (${x.occupancy}%)`,
        }))}
      />
      <Axis
        dates={d.forecast_7d.map((x) => x.date)}
        today={d.today}
      />
    </ChartCard>
  );
}
