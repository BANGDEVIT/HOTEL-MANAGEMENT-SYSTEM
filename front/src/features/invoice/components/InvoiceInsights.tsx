import { useState } from "react";
import { Info } from "lucide-react";
import { useInvoiceStore } from "../store/invoiceStore";
import {
  bucketDaily,
  formatMoney,
  formatMoneyShort,
  METHOD_META,
  niceMax,
  rangeLabel,
} from "../utils/invoiceMeta";

const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * 2 khung dưới ô số liệu, theo KỲ đang chọn:
 *   - Thực thu theo ngày (cột): thấy ngày nào thu nhiều, ngày nào không thu
 *   - Theo phương thức (thanh ngang): đối soát tiền mặt trong két với sao kê ngân hàng
 * Chỉ 1 chuỗi số liệu -> 1 màu navy, không cần chú thích màu.
 */
export default function InvoiceInsights() {
  const stats = useInvoiceStore((s) => s.stats);
  if (!stats) return null;

  const methodTotal = stats.by_method.reduce((s, m) => s + m.amount, 0);
  const methodMax = Math.max(1, ...stats.by_method.map((m) => m.amount));

  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
      <DailyChart />

      <section
        aria-label="Thực thu theo phương thức"
        className="rounded-[16px] border border-line bg-white px-5 py-4"
      >
        <h3 className="text-[13px] font-semibold text-ink">Theo phương thức</h3>
        <p className="text-[11.5px] tabular-nums text-ink-faint">
          {rangeLabel(stats.from, stats.to)} · {stats.collected.count} phiếu thu
        </p>

        <ul className="mt-3 grid gap-3">
          {stats.by_method.map((m) => {
            const { label, icon: Icon } = METHOD_META[m.method];
            const share = methodTotal
              ? Math.round((m.amount / methodTotal) * 100)
              : 0;
            return (
              <li
                key={m.method}
                className="grid grid-cols-[124px_1fr_76px] items-center gap-x-3 gap-y-0.5 text-[13px]"
              >
                <span className="flex items-center gap-2 whitespace-nowrap text-ink">
                  <Icon
                    size={14}
                    className="text-ink-faint"
                    aria-hidden="true"
                  />{" "}
                  {label}
                </span>
                <span
                  className="h-2 overflow-hidden rounded-full bg-segment"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-navy-700"
                    style={{ width: `${(m.amount / methodMax) * 100}%` }}
                  />
                </span>
                <span
                  className="text-right font-semibold tabular-nums text-ink"
                  title={formatMoney(m.amount)}
                >
                  {formatMoneyShort(m.amount)}
                </span>
                <span className="col-start-2 col-end-4 text-[11px] tabular-nums text-ink-faint">
                  {share}% · {m.count} phiếu
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 flex items-start gap-1.5 border-t border-line-soft pt-3 text-[11.5px] text-ink-muted">
          <Info
            size={13}
            className="mt-px shrink-0"
            aria-hidden="true"
          />
          Chuyển khoản và ví điện tử luôn có mã giao dịch để đối soát sao kê cuối
          ngày.
        </p>
      </section>
    </div>
  );
}

/* ============================ Biểu đồ cột ============================ */

const CHART_H = 200;

/**
 * Cột bằng div flex (không dùng SVG co giãn) -> chữ trục không bị méo khi đổi độ rộng.
 * Rê chuột / focus (Tab) vào cột -> hiện số tiền.
 */
function DailyChart() {
  const stats = useInvoiceStore((s) => s.stats)!;
  const [hover, setHover] = useState<number | null>(null);

  const { size, bars } = bucketDaily(stats.daily);
  const top = niceMax(Math.max(0, ...bars.map((b) => b.amount)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const peak = bars.reduce(
    (best, b) => (b.amount > best.amount ? b : best),
    bars[0],
  );
  const labelEvery = Math.max(1, Math.ceil(bars.length / 7));
  const barLabel = (b: (typeof bars)[number]) =>
    b.from === b.to ? dm(b.from) : `${dm(b.from)} – ${dm(b.to)}`;

  return (
    <section
      aria-label="Thực thu theo ngày"
      className="rounded-[16px] border border-line bg-white px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">
            Thực thu theo {size > 1 ? `mỗi ${size} ngày` : "ngày"}
          </h3>
          <p className="text-[11.5px] text-ink-faint">
            Theo ngày thu tiền, không tính phiếu đã huỷ
          </p>
        </div>
        {peak && peak.amount > 0 && (
          <p className="text-right text-[11.5px] tabular-nums text-ink-faint">
            Cao nhất{" "}
            <b className="font-semibold text-ink">{formatMoneyShort(peak.amount)}</b>{" "}
            {barLabel(peak)}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-[44px_1fr] gap-2">
        {/* Trục tung */}
        <div
          className="relative"
          style={{ height: CHART_H }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[10.5px] tabular-nums text-ink-faint"
              style={{ top: CHART_H * (1 - t / top) }}
            >
              {t ? formatMoneyShort(t) : "0"}
            </span>
          ))}
        </div>

        <div>
          <div
            role="img"
            aria-label={`Thực thu ${rangeLabel(stats.from, stats.to)}: tổng ${formatMoney(stats.collected.amount)}`}
            className="relative flex items-end gap-[3px]"
            style={{ height: CHART_H }}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t border-line-soft"
                style={{ top: CHART_H * (1 - t / top) }}
                aria-hidden="true"
              />
            ))}

            {bars.map((b, i) => (
              <span
                key={b.from}
                className="relative flex h-full min-w-0 flex-1 cursor-crosshair items-end"
                onMouseEnter={() => setHover(i)}
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-colors ${
                    b.amount === 0
                      ? "bg-segment"
                      : hover === i
                        ? "bg-gold-500"
                        : "bg-navy-700"
                  }`}
                  style={{
                    height: b.amount ? Math.max(3, (b.amount / top) * CHART_H) : 2,
                  }}
                />
                {hover === i && (
                  <span
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-[7px] bg-navy-900 px-2.5 py-1.5 text-[11.5px] text-white shadow-[0_6px_18px_rgba(20,38,59,.25)] ${
                      i > bars.length * 0.7
                        ? "right-0"
                        : i < bars.length * 0.3
                          ? "left-0"
                          : "left-1/2 -translate-x-1/2"
                    }`}
                    style={{ bottom: Math.max(3, (b.amount / top) * CHART_H) + 6 }}
                  >
                    <b className="block text-[12.5px] font-semibold tabular-nums">
                      {formatMoney(b.amount)}
                    </b>
                    <span className="tabular-nums text-on-navy-muted">
                      {barLabel(b)}
                    </span>
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* Trục hoành */}
          <div
            className="mt-1.5 flex gap-[3px]"
            aria-hidden="true"
          >
            {bars.map((b, i) => (
              <span
                key={b.from}
                className="min-w-0 flex-1 text-center text-[10.5px] tabular-nums text-ink-faint"
              >
                {i % labelEvery === 0 ? (
                  <span className="whitespace-nowrap">{dm(b.from)}</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
