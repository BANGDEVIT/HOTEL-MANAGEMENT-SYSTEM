import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { InvoiceDetail } from "../../../types/invoice";
import { UNIT_LABELS } from "../../../types/service";
import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatRange,
  HOTEL_INFO,
  METHOD_META,
} from "../utils/invoiceMeta";

/**
 * Xem trước + in hoá đơn khổ A4. Không dùng thư viện PDF:
 *   window.print() -> người dùng chọn máy in, hoặc "Lưu dưới dạng PDF".
 *
 * Khi in, CSS @media print ẩn MỌI THỨ trên trang trừ khung #invoice-print
 * (render qua portal thẳng vào body), và ẩn thanh công cụ (.no-print).
 */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  body > *:not(#invoice-print) { display: none !important; }
  #invoice-print { position: static !important; background: #fff !important; overflow: visible !important; padding: 0 !important; }
  #invoice-print .no-print { display: none !important; }
  #invoice-print .paper { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; }
  #invoice-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

export default function InvoicePrint({
  invoice: inv,
  onClose,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = inv.payments.filter((p) => !p.voided);
  const b = inv.booking;
  const printedAt = formatDateTime(new Date().toISOString());

  return createPortal(
    // aria-modal: drawer biết đang có lớp phủ, phím Esc không đóng drawer
    <div
      id="invoice-print"
      role="dialog"
      aria-modal="true"
      aria-label={`In hoá đơn ${inv.code}`}
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#5B6170] pb-8"
    >
      <style>{PRINT_CSS}</style>

      <div className="no-print sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-white px-5">
        <div>
          <p className="text-[14px] font-semibold text-ink">
            Xem trước bản in · {inv.code}
          </p>
          <p className="text-[12px] text-ink-muted">
            Khổ A4 · chọn "Lưu dưới dạng PDF" trong hộp thoại in để lưu file
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center gap-1.5 rounded-[8px] border border-line-input bg-white px-3 text-[13px] text-ink hover:border-navy-700"
          >
            <X size={14} /> Đóng
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-[8px] bg-navy-700 px-3.5 text-[13px] font-semibold text-white hover:bg-navy-hover"
          >
            <Printer size={14} /> In / Lưu PDF
          </button>
        </div>
      </div>

      <article className="paper mx-auto mt-6 w-[680px] max-w-[calc(100%-32px)] bg-white px-11 py-10 text-[12px] text-ink shadow-[0_10px_30px_rgba(0,0,0,.25)]">
        {/* Đầu trang */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-navy-700 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[9px] bg-gold-500 font-display text-[18px] font-bold text-navy-900">
              {HOTEL_INFO.name[0]}
            </span>
            <div>
              <p className="font-display text-[18px] font-bold text-navy-900">
                {HOTEL_INFO.name}
              </p>
              <p className="text-[10.5px] leading-relaxed text-ink-muted">
                {HOTEL_INFO.address}
                <br />
                {HOTEL_INFO.phone} · {HOTEL_INFO.email}
              </p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-display text-[22px] font-bold tracking-[.02em] text-navy-900">
              HOÁ ĐƠN
            </h1>
            <p className="tabular-nums">
              Số <b>{inv.code}</b>
            </p>
            <p className="tabular-nums text-ink-muted">In lúc {printedAt}</p>
            {inv.remaining > 0 ? (
              <span className="mt-1.5 inline-block rounded-[4px] border border-room-occupied px-2 py-0.5 text-[10.5px] font-semibold tracking-[.04em] text-room-occupied">
                CÒN THIẾU {formatMoney(inv.remaining)}
              </span>
            ) : (
              <span className="mt-1.5 inline-block rounded-[4px] border border-room-available px-2 py-0.5 text-[10.5px] font-semibold tracking-[.04em] text-room-available">
                ĐÃ THANH TOÁN
              </span>
            )}
          </div>
        </header>

        {/* Khách + lưu trú */}
        <section className="mt-4 grid grid-cols-2 gap-6">
          <InfoBlock
            title="Khách hàng"
            rows={[
              ["Họ tên", <b key="n">{inv.customer.full_name}</b>],
              ["Điện thoại", formatPhone(inv.customer.phone) || "—"],
              ...(inv.customer.email
                ? [["Email", inv.customer.email] as [string, React.ReactNode]]
                : []),
              ...(inv.customer.nationality
                ? [
                    ["Quốc tịch", inv.customer.nationality] as [
                      string,
                      React.ReactNode,
                    ],
                  ]
                : []),
            ]}
          />
          <InfoBlock
            title="Lưu trú"
            rows={[
              ["Đặt phòng", b.code],
              [
                "Nhận phòng",
                b.actual_check_in ? formatDateTime(b.actual_check_in) : "—",
              ],
              [
                "Trả phòng",
                b.actual_check_out
                  ? formatDateTime(b.actual_check_out)
                  : `Dự kiến ${formatDate(b.check_out_date)}`,
              ],
              [
                "Số khách",
                b.children
                  ? `${b.adults} người lớn, ${b.children} trẻ em`
                  : `${b.adults} người lớn`,
              ],
            ]}
          />
        </section>

        {/* Chi tiết */}
        <table className="mt-5 w-full border-collapse tabular-nums">
          <thead>
            <tr className="bg-cream-50 text-[10px] uppercase tracking-[.06em] text-ink-muted">
              <th className="border-b border-line-input px-1.5 py-2 text-left font-semibold">
                Nội dung
              </th>
              <th className="border-b border-line-input px-1.5 py-2 text-right font-semibold">
                SL
              </th>
              <th className="border-b border-line-input px-1.5 py-2 text-right font-semibold">
                Đơn giá
              </th>
              <th className="border-b border-line-input px-1.5 py-2 text-right font-semibold">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            <GroupRow label="Tiền phòng" />
            {inv.rooms.map((r) => (
              <tr key={r.room_number}>
                <Td>
                  Phòng {r.room_number} · {r.room_type} (
                  {formatRange(b.check_in_date, b.check_out_date)})
                </Td>
                <Td right>{r.nights} đêm</Td>
                <Td right>{formatAmount(r.price_per_night)}</Td>
                <Td right>{formatAmount(r.amount)}</Td>
              </tr>
            ))}
            {inv.services.length > 0 && <GroupRow label="Dịch vụ" />}
            {inv.services.map((s) => (
              <tr key={s.id}>
                <Td>
                  {s.name} · {formatDate(s.used_at).slice(0, 5)}
                </Td>
                <Td right>
                  {s.quantity} {UNIT_LABELS[s.unit]}
                </Td>
                <Td right>{formatAmount(s.unit_price)}</Td>
                <Td right>{formatAmount(s.total_price)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tổng */}
        <dl className="ml-auto mt-3 grid w-[290px] grid-cols-[1fr_auto] gap-y-1 tabular-nums">
          <dt className="text-ink-muted">Cộng</dt>
          <dd className="text-right">{formatMoney(inv.total_amount)}</dd>
          <dt className="text-ink-muted">Giảm giá</dt>
          <dd className="text-right">
            {inv.discount ? `−${formatMoney(inv.discount)}` : "0đ"}
          </dd>
          <dt className="mt-1 border-t border-line-input pt-1.5 text-[14px] font-bold">
            Phải trả
          </dt>
          <dd className="mt-1 border-t border-line-input pt-1.5 text-right text-[14px] font-bold">
            {formatMoney(inv.final_amount)}
          </dd>
          <dt className="text-ink-muted">Đã thanh toán</dt>
          <dd className="text-right">{formatMoney(inv.paid_amount)}</dd>
          {inv.remaining > 0 && (
            <>
              <dt className="font-bold text-room-occupied">Còn thiếu</dt>
              <dd className="text-right font-bold text-room-occupied">
                {formatMoney(inv.remaining)}
              </dd>
            </>
          )}
        </dl>

        {/* Thanh toán */}
        {active.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[.08em] text-ink-faint">
              Thanh toán
            </h2>
            <table className="w-full border-collapse tabular-nums">
              <tbody>
                {active.map((p) => (
                  <tr key={p.id}>
                    <Td>{formatDateTime(p.paid_at)}</Td>
                    <Td>
                      {METHOD_META[p.payment_method].label}
                      {p.reference_number && ` · ${p.reference_number}`}
                      {p.note && ` (${p.note})`}
                    </Td>
                    <Td right>{formatAmount(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Chữ ký */}
        <section className="mt-8 grid grid-cols-2 text-center">
          <Sign
            title="Khách hàng"
            name={inv.customer.full_name}
          />
          <Sign
            title="Thu ngân"
            name={b.checked_out_by ?? ""}
          />
        </section>

        <footer className="mt-6 border-t border-line-soft pt-2.5 text-center text-[10.5px] text-ink-faint">
          Cảm ơn quý khách đã lưu trú tại {HOTEL_INFO.name}. Hoá đơn này không thay
          thế hoá đơn GTGT.
        </footer>
      </article>
    </div>,
    document.body,
  );
}

/* ============================ Mảnh nhỏ ============================ */

function InfoBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, React.ReactNode][];
}) {
  return (
    <div>
      <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-ink-faint">
        {title}
      </h2>
      <dl className="grid grid-cols-[84px_1fr] gap-y-0.5 tabular-nums">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="contents"
          >
            <dt className="text-ink-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GroupRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={4}
        className="border-b border-line-soft px-1.5 pb-1.5 pt-2.5 text-[11px] font-semibold text-gold-700"
      >
        {label}
      </td>
    </tr>
  );
}

function Td({
  right = false,
  children,
}: {
  right?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td
      className={`border-b border-line-soft px-1.5 py-1.5 align-top ${right ? "whitespace-nowrap text-right" : ""}`}
    >
      {children}
    </td>
  );
}

function Sign({ title, name }: { title: string; name: string }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <p className="text-[10.5px] text-ink-faint">(Ký, ghi rõ họ tên)</p>
      <p className="mt-12 min-h-[18px]">{name}</p>
    </div>
  );
}
