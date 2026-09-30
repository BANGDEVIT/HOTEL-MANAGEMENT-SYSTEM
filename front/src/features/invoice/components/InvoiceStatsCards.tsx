import {
  AlertTriangle,
  BedDouble,
  FileX2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useInvoiceStore } from "../store/invoiceStore";
import type { InvoiceTab } from "../../../types/invoice";
import {
  formatMoney,
  formatMoneyShort,
  percentChange,
  rangeLabel,
} from "../utils/invoiceMeta";

interface Card {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  value: React.ReactNode;
  note: React.ReactNode;
  /** Có thì cả ô bấm được: chuyển bảng sang tab này */
  tab?: InvoiceTab;
  alert?: boolean;
  title?: string;
}

/**
 * 4 ô số liệu:
 *   - Thực thu, Phiếu huỷ: theo KỲ đang chọn ở đầu trang
 *   - Còn phải thu (đang ở), Công nợ: tình trạng HIỆN TẠI, không phụ thuộc kỳ
 * 2 ô sau bấm được -> nhảy tới tab tương ứng của bảng.
 */
export default function InvoiceStatsCards() {
  const stats = useInvoiceStore((s) => s.stats);
  const tab = useInvoiceStore((s) => s.filters.tab);
  const setFilters = useInvoiceStore((s) => s.setFilters);

  const change = stats
    ? percentChange(stats.collected.amount, stats.previous.amount)
    : null;
  const hasDebt = (stats?.debt.count ?? 0) > 0;

  const cards: Card[] = [
    {
      key: "collected",
      label: stats ? `Thực thu ${rangeLabel(stats.from, stats.to)}` : "Thực thu",
      icon: Wallet,
      tint: "var(--color-room-available)",
      value: stats ? formatMoneyShort(stats.collected.amount) : "–",
      title: stats ? formatMoney(stats.collected.amount) : undefined,
      note: !stats ? (
        " "
      ) : (
        <>
          {change === null ? (
            "kỳ trước chưa thu"
          ) : (
            <span
              style={{
                color:
                  change >= 0
                    ? "var(--color-room-available)"
                    : "var(--color-room-occupied)",
              }}
            >
              {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% so với kỳ trước
            </span>
          )}
          <span className="float-right tabular-nums">
            {stats.collected.count} phiếu
          </span>
        </>
      ),
    },
    {
      key: "open",
      label: "Còn phải thu (khách đang ở)",
      icon: BedDouble,
      tint: "var(--color-navy-600)",
      value: stats ? formatMoneyShort(stats.open.amount) : "–",
      title: stats ? formatMoney(stats.open.amount) : undefined,
      note: stats ? `${stats.open.count} hoá đơn đang mở, thu khi trả phòng` : " ",
      tab: "open",
    },
    {
      key: "debt",
      label: "Công nợ",
      icon: AlertTriangle,
      tint: hasDebt ? "var(--color-room-occupied)" : "var(--color-room-maintenance)",
      value: stats ? (
        <span style={{ color: hasDebt ? "var(--color-room-occupied)" : undefined }}>
          {formatMoneyShort(stats.debt.amount)}
        </span>
      ) : (
        "–"
      ),
      title: stats ? formatMoney(stats.debt.amount) : undefined,
      note: !stats
        ? " "
        : hasDebt
          ? `${stats.debt.count} khách đã trả phòng còn thiếu`
          : "Không có công nợ",
      tab: "debt",
      alert: hasDebt,
    },
    {
      key: "voided",
      label: "Phiếu thu đã huỷ",
      icon: FileX2,
      tint: "var(--color-room-maintenance)",
      value: stats ? (
        <>
          {stats.voided.count}
          {stats.voided.count > 0 && (
            <span className="text-[14px] font-medium text-ink-faint">
              {" "}
              · {formatMoneyShort(stats.voided.amount)}
            </span>
          )}
        </>
      ) : (
        "–"
      ),
      note: stats ? `Giảm giá trong kỳ: ${formatMoney(stats.discount_total)}` : " ",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {cards.map(
        ({
          key,
          label,
          icon: Icon,
          tint,
          value,
          note,
          tab: target,
          alert,
          title,
        }) => {
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
                  <span
                    className="block text-[24px] font-bold leading-tight tabular-nums text-ink"
                    title={title}
                  >
                    {value}
                  </span>
                </span>
              </span>
              <span className="mt-3 block truncate border-t border-line-soft pt-2 text-[11.5px] text-ink-faint">
                {note}
              </span>
            </>
          );
          const base = `min-w-0 rounded-[16px] border bg-white px-4 py-3.5 text-left ${
            alert ? "shadow-[inset_3px_0_0_var(--color-room-occupied)]" : ""
          }`;

          if (!target) {
            return (
              <div
                key={key}
                className={`${base} border-line`}
              >
                {body}
              </div>
            );
          }
          const on = tab === target;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilters({ tab: on ? "all" : target })}
              className={`${base} transition-colors ${
                on
                  ? "border-navy-700 shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
                  : alert
                    ? "border-[#E7C3BA] hover:border-room-occupied"
                    : "border-line hover:border-line-input"
              }`}
            >
              {body}
            </button>
          );
        },
      )}
    </div>
  );
}
