import { ChevronRight } from "lucide-react";
import { useInvoiceStore } from "../store/invoiceStore";
import type { InvoiceListItem } from "../../../types/invoice";
import { StatusPill } from "./InvoiceBits";
import {
  avatarColor,
  displayStatus,
  formatAmount,
  formatRange,
  initialsOfFullName,
  METHOD_META,
  progressColor,
} from "../utils/invoiceMeta";

interface Props {
  selectedId: string | null;
  onOpen: (id: string) => void;
}

/** Header và dòng dùng CHUNG 1 hằng số cột */
const COLS =
  "grid-cols-[minmax(140px,.9fr)_minmax(220px,1.5fr)_minmax(150px,1fr)_110px_minmax(160px,1.05fr)_120px_14px]";

const EMPTY: Record<string, { title: string; hint: string }> = {
  all: { title: "Chưa có hoá đơn nào", hint: "Hoá đơn tự mở khi khách nhận phòng." },
  open: {
    title: "Không có khách nào đang ở",
    hint: "Hoá đơn của khách đang ở sẽ hiện ở đây.",
  },
  debt: {
    title: "Không có công nợ",
    hint: "Mọi khách đã trả phòng đều đã thanh toán đủ.",
  },
  paid: { title: "Chưa có hoá đơn nào thu đủ", hint: "Thử bỏ bớt bộ lọc." },
};

export default function InvoiceTable({ selectedId, onOpen }: Props) {
  const invoices = useInvoiceStore((s) => s.invoices);
  const loading = useInvoiceStore((s) => s.loading);
  const lastUpdated = useInvoiceStore((s) => s.lastUpdated);
  const filters = useInvoiceStore((s) => s.filters);

  if (loading && !lastUpdated) {
    return (
      <p className="py-16 text-center text-[13px] text-ink-muted">
        Đang tải danh sách hoá đơn
      </p>
    );
  }

  if (invoices.length === 0) {
    const filtered = filters.search || filters.method || filters.created;
    const e = filtered
      ? {
          title: "Không có hoá đơn phù hợp",
          hint: "Thử từ khoá khác hoặc bỏ bớt bộ lọc.",
        }
      : EMPTY[filters.tab];
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[14px] font-medium text-ink">{e.title}</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">{e.hint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1000px]">
        <div
          aria-hidden="true"
          className={`grid ${COLS} h-10 items-center gap-[14px] whitespace-nowrap border-b border-line px-[18px] text-[11px] font-semibold uppercase tracking-[.06em] text-ink-faint`}
        >
          <span>Hoá đơn</span>
          <span>Khách</span>
          <span>Lưu trú</span>
          <span className="text-right">Phải trả</span>
          <span>Đã thu</span>
          <span>Trạng thái</span>
          <span />
        </div>

        {invoices.map((inv) => (
          <Row
            key={inv.id}
            invoice={inv}
            selected={inv.id === selectedId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  invoice: inv,
  selected,
  onOpen,
}: {
  invoice: InvoiceListItem;
  selected: boolean;
  onOpen: Props["onOpen"];
}) {
  const color = avatarColor(inv.customer.id);
  const status = displayStatus(inv.status, inv.is_debt);
  const pct = inv.final_amount
    ? Math.min(100, Math.round((inv.paid_amount / inv.final_amount) * 100))
    : 100;
  const inHouse = inv.booking.status === "checked_in";

  const rule = inv.is_debt
    ? "shadow-[inset_3px_0_0_var(--color-room-occupied)]"
    : selected
      ? "shadow-[inset_3px_0_0_var(--color-gold-500)]"
      : "";
  const bg = selected
    ? inv.is_debt
      ? "bg-[#FBF1EE]"
      : "bg-gold-50"
    : "hover:bg-row-hover";

  return (
    <div
      className={`relative grid ${COLS} min-h-[62px] items-center gap-[14px] border-b border-line-soft px-[18px] py-2.5 transition-colors ${rule} ${bg}`}
    >
      {/* Hoá đơn */}
      <span className="min-w-0">
        {/* Nút phủ cả dòng (stretched link): bấm chỗ nào trên dòng cũng mở drawer */}
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onOpen(inv.id)}
          className="block whitespace-nowrap text-left text-[13px] font-semibold tabular-nums text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-navy-700"
        >
          {inv.code}
        </button>
        <span className="block whitespace-nowrap text-[11.5px] tabular-nums text-ink-muted">
          {inv.booking.code}
        </span>
      </span>

      {/* Khách */}
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: color.bg, color: color.fg }}
          aria-hidden="true"
        >
          {initialsOfFullName(inv.customer.full_name)}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-ink">
              {inv.customer.full_name}
            </span>
            {inv.customer.is_member && (
              <span className="shrink-0 rounded-[5px] bg-gold-50 px-1.5 text-[10.5px] font-medium text-gold-700">
                Thành viên
              </span>
            )}
          </span>
          <span className="block truncate text-[11.5px] tabular-nums text-ink-muted">
            Phòng {inv.rooms.join(", ")}
          </span>
        </span>
      </span>

      {/* Lưu trú */}
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[12.5px] tabular-nums text-ink">
          {formatRange(inv.booking.check_in_date, inv.booking.check_out_date)} ·{" "}
          {inv.booking.nights} đêm
        </span>
        <span className="block text-[11.5px] text-ink-faint">
          {inHouse ? "Đang ở" : "Đã trả phòng"}
        </span>
      </span>

      {/* Phải trả */}
      <span className="text-right">
        <span className="block whitespace-nowrap text-[13.5px] font-semibold tabular-nums text-ink">
          {formatAmount(inv.final_amount)}
        </span>
        {inv.discount > 0 && (
          <span className="block whitespace-nowrap text-[11px] tabular-nums text-room-available">
            đã giảm {formatAmount(inv.discount)}
          </span>
        )}
      </span>

      {/* Đã thu */}
      <span className="min-w-0">
        <span className="flex justify-between gap-2 whitespace-nowrap text-[12px] tabular-nums">
          <b className="font-semibold text-ink">{formatAmount(inv.paid_amount)}</b>
          <span className={inv.is_debt ? "text-room-occupied" : "text-ink-faint"}>
            {inv.remaining > 0 ? `còn ${formatAmount(inv.remaining)}` : `${pct}%`}
          </span>
        </span>
        <span
          className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-segment"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: progressColor(status) }}
          />
        </span>
        {inv.methods.length > 0 && (
          <span className="mt-1 block truncate text-[11px] text-ink-faint">
            {inv.methods.map((m) => METHOD_META[m].label).join(" · ")}
          </span>
        )}
      </span>

      {/* Trạng thái */}
      <span>
        <StatusPill status={status} />
      </span>

      <ChevronRight
        size={14}
        className="text-ink-faint"
        aria-hidden="true"
      />
    </div>
  );
}
