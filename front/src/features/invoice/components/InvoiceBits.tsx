/**
 * Mảnh giao diện nhỏ dùng chung trong màn Hoá đơn.
 * File .tsx chỉ export component (luật react-refresh/only-export-components).
 */
import { CircleSlash } from "lucide-react";
import type { InvoicePayment } from "../../../types/invoice";
import {
  formatAmount,
  formatDateTime,
  METHOD_META,
  STATUS_META,
  type DisplayStatus,
} from "../utils/invoiceMeta";

/** Pill trạng thái: Chưa thu / Thu một phần / Đã thu đủ / Công nợ */
export function StatusPill({
  status,
  className = "",
}: {
  status: DisplayStatus;
  className?: string;
}) {
  const { label, color } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ${className}`}
      style={{ color, background: `color-mix(in srgb, ${color} 11%, white)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/**
 * 1 phiếu thu: icon phương thức, số tiền, lúc thu, người thu.
 * Phiếu đã huỷ: gạch ngang + khung đỏ ghi ai huỷ, lúc nào, lý do.
 * `action` = nút bên phải (VD "Huỷ phiếu"), chỉ truyền khi được phép.
 */
export function PaymentLine({
  payment: p,
  action,
}: {
  payment: InvoicePayment;
  action?: React.ReactNode;
}) {
  const { label, icon: Icon } = METHOD_META[p.payment_method];
  const voided = p.voided !== null;

  return (
    <li className="grid grid-cols-[32px_1fr_auto_auto] items-center gap-x-3 gap-y-0.5 border-b border-line-soft py-2.5 last:border-b-0">
      <span
        className={`row-span-2 flex h-8 w-8 items-center justify-center rounded-[8px] ${
          voided ? "bg-[#F8E4DF] text-room-occupied" : "bg-cream-50 text-navy-700"
        }`}
        aria-hidden="true"
      >
        {voided ? <CircleSlash size={15} /> : <Icon size={15} />}
      </span>
      <span
        className={`min-w-0 truncate text-[13px] font-semibold ${voided ? "text-ink-faint line-through" : "text-ink"}`}
      >
        {label}
        {p.reference_number && (
          <span className="font-normal tabular-nums"> · {p.reference_number}</span>
        )}
        {p.note && <span className="font-normal"> · {p.note}</span>}
      </span>
      <span
        className={`row-span-2 text-right text-[13.5px] font-semibold tabular-nums ${
          voided ? "text-ink-faint line-through" : "text-ink"
        }`}
      >
        {formatAmount(p.amount)}
      </span>
      <span className="row-span-2">{action}</span>
      <span className="text-[11.5px] tabular-nums text-ink-muted">
        {formatDateTime(p.paid_at)}
        {p.received_by && ` · thu bởi ${p.received_by}`}
      </span>
      {voided && (
        <span className="col-start-2 col-end-5 mt-1.5 rounded-[7px] bg-[#F8E4DF] px-2.5 py-1.5 text-[11.5px] leading-snug text-[#7A2616]">
          <b className="font-semibold">
            Đã huỷ {formatDateTime(p.voided!.at)}
            {p.voided!.by && ` bởi ${p.voided!.by}`}.
          </b>{" "}
          {p.voided!.reason}
        </span>
      )}
    </li>
  );
}
