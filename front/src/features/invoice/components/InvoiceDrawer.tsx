import { useEffect, useState } from "react";
import { Lock, Printer, Star, Wallet, X } from "lucide-react";
import { invoiceApi } from "../../../api/invoiceApi";
import { errorMessage } from "../../../utils/errorMessage";
import type { InvoiceDetail, InvoicePayment } from "../../../types/invoice";
import { UNIT_LABELS } from "../../../types/service";
import {
  displayStatus,
  formatAmount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatRange,
  progressColor,
} from "../utils/invoiceMeta";
import { PaymentLine, StatusPill } from "./InvoiceBits";
import CollectPaymentDialog from "./CollectPaymentDialog";
import VoidPaymentDialog from "./VoidPaymentDialog";
import InvoicePrint from "./InvoicePrint";

interface Props {
  opened: { id: string; seq: number } | null;
  onClose: () => void;
  /** Hoá đơn vừa đổi (thu tiền / huỷ phiếu) -> trang cha tải lại danh sách + số liệu */
  onChanged: () => void;
}

/**
 * Ngăn trượt bên phải, cùng khuôn với drawer Đặt phòng.
 * Khung ngoài LUÔN render (để có hiệu ứng trượt); thân gắn key = seq -> mỗi lần mở là thân MỚI.
 */
export default function InvoiceDrawer({ opened, onClose, onChanged }: Props) {
  const open = opened !== null;

  // Esc đóng drawer, TRỪ KHI đang có hộp thoại / bản in (chúng tự lo phím Esc)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key !== "Escape" ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-label="Chi tiết hoá đơn"
      aria-hidden={!open}
      className={`fixed inset-y-0 right-0 z-40 flex w-[460px] max-w-full flex-col border-l border-line bg-white transition-transform duration-200 motion-reduce:transition-none ${
        open
          ? "translate-x-0 shadow-[-12px_0_40px_rgba(20,38,59,.18)]"
          : "pointer-events-none invisible translate-x-full"
      }`}
    >
      {opened && (
        <DrawerBody
          key={opened.seq}
          id={opened.id}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </aside>
  );
}

type Dialog =
  | { kind: "collect" }
  | { kind: "void"; payment: InvoicePayment }
  | { kind: "print" }
  | null;

function DrawerBody({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  // setState nằm trong .then, không chạy đồng bộ trong effect
  useEffect(() => {
    let cancelled = false;
    invoiceApi
      .detail(id)
      .then((d) => !cancelled && setInvoice(d))
      .catch(
        (err) => !cancelled && setError(errorMessage(err, "Không tải được hoá đơn")),
      );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="p-6">
        <div className="flex justify-end">
          <CloseButton
            onClose={onClose}
            dark={false}
          />
        </div>
        <p className="mt-10 text-center text-[13px] text-room-occupied">{error}</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="h-[200px] animate-pulse bg-navy-700" />
        <p className="py-10 text-center text-[13px] text-ink-muted">
          Đang tải hoá đơn
        </p>
      </div>
    );
  }

  const inv = invoice;
  const b = inv.booking;
  const can = (a: InvoiceDetail["allowed_actions"][number]) =>
    inv.allowed_actions.includes(a);
  const status = displayStatus(inv.status, inv.is_debt);
  const pct = inv.final_amount
    ? Math.min(100, Math.round((inv.paid_amount / inv.final_amount) * 100))
    : 100;
  const activeCount = inv.payments.filter((p) => !p.voided).length;
  const voidedCount = inv.payments.length - activeCount;
  const rooms = inv.rooms.map((r) => r.room_number).join(", ");

  /** Hộp thoại xong việc đều gọi hàm này với chi tiết MỚI do BE trả về */
  const done = (next: InvoiceDetail) => {
    setInvoice(next);
    setDialog(null);
    onChanged();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ===== Header navy ===== */}
      <header className="bg-navy-700 px-5 pb-4 pt-4 text-white">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] tabular-nums text-on-navy-muted">
              {inv.code} · lập {formatDateTime(inv.created_at)}
            </p>
            <h2 className="mt-1 truncate font-display text-[22px] font-bold leading-tight">
              {inv.customer.full_name}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed tabular-nums text-on-navy-muted">
              {formatPhone(inv.customer.phone) || "Chưa có SĐT"} · Phòng {rooms} ·{" "}
              {formatRange(b.check_in_date, b.check_out_date)} ({b.nights} đêm)
              <br />
              Đặt phòng {b.code}
              {b.checked_out_by && ` · trả phòng bởi ${b.checked_out_by}`}
            </p>
          </div>
          <CloseButton
            onClose={onClose}
            dark
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white">
            <StatusPill status={status} />
          </span>
          <span className="whitespace-nowrap rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] text-[#DCE3EE]">
            {b.status === "checked_in" ? "Đang ở" : "Đã trả phòng"}
          </span>
          {inv.customer.is_member && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gold-500 px-2.5 py-1 text-[11.5px] font-semibold text-navy-900">
              <Star
                size={11}
                fill="currentColor"
                strokeWidth={0}
              />{" "}
              Thành viên
            </span>
          )}
        </div>

        <div
          className={`mt-3 grid gap-1.5 ${can("collect") ? "grid-cols-[1.4fr_1fr]" : "grid-cols-1"}`}
        >
          {can("collect") && (
            <button
              type="button"
              onClick={() => setDialog({ kind: "collect" })}
              className="flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] bg-gold-500 px-2 text-[12.5px] font-semibold text-navy-900 hover:brightness-95"
            >
              <Wallet
                size={14}
                strokeWidth={2}
              />
              {inv.is_debt ? `Thu nợ ${formatMoney(inv.remaining)}` : "Thu tạm ứng"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDialog({ kind: "print" })}
            className="flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] bg-white/10 px-2 text-[12.5px] hover:bg-white/15"
          >
            <Printer
              size={14}
              strokeWidth={2}
            />{" "}
            In / Lưu PDF
          </button>
        </div>
      </header>

      {/* ===== Phải trả / Đã thu / Còn thiếu ===== */}
      <div className="grid grid-cols-3 border-b border-line-soft">
        <Stat
          label="Phải trả"
          value={formatAmount(inv.final_amount)}
        />
        <Stat
          label="Đã thu"
          value={formatAmount(inv.paid_amount)}
        />
        <Stat
          label={inv.is_debt ? "Còn nợ" : "Còn thiếu"}
          value={formatAmount(inv.remaining)}
          red={inv.is_debt}
        />
      </div>
      <div className="border-b border-line px-5 pb-3 pt-2.5">
        <span
          className="block h-2 overflow-hidden rounded-full bg-segment"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: progressColor(status) }}
          />
        </span>
        <p className="mt-1.5 flex justify-between text-[11px] tabular-nums text-ink-faint">
          <span>Đã thu {pct}%</span>
          <span>
            {activeCount} phiếu còn hiệu lực
            {voidedCount > 0 && ` · ${voidedCount} phiếu đã huỷ`}
          </span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ===== Chi tiết ===== */}
        <Section
          title="Chi tiết"
          note={
            b.status === "checked_in"
              ? "Tạm tính, dịch vụ còn cộng thêm"
              : "Giá chốt lúc dùng"
          }
        >
          <ul>
            {inv.rooms.map((r) => (
              <Line
                key={r.room_number}
                title={`Phòng ${r.room_number} · ${r.room_type}`}
                sub={`${r.nights} đêm × ${formatAmount(r.price_per_night)}`}
                amount={r.amount}
              />
            ))}
            {inv.services.map((s) => (
              <Line
                key={s.id}
                title={s.name}
                sub={`${s.quantity} ${UNIT_LABELS[s.unit]} × ${formatAmount(s.unit_price)} · ${formatDate(s.used_at).slice(0, 5)}${
                  s.note ? ` · ${s.note}` : ""
                }`}
                amount={s.total_price}
              />
            ))}
          </ul>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1.5 border-t border-line pt-2.5 text-[13px] tabular-nums">
            <dt className="text-ink-muted">Tiền phòng</dt>
            <dd className="text-right text-ink">{formatAmount(inv.room_total)}</dd>
            <dt className="text-ink-muted">Dịch vụ</dt>
            <dd className="text-right text-ink">
              {formatAmount(inv.service_total)}
            </dd>
            <dt className="text-ink-muted">Giảm giá</dt>
            <dd className="text-right text-room-available">
              {inv.discount ? `−${formatAmount(inv.discount)}` : "0"}
            </dd>
            <dt className="text-[14px] font-semibold text-ink">Phải trả</dt>
            <dd className="text-right text-[14px] font-semibold text-ink">
              {formatMoney(inv.final_amount)}
            </dd>
          </dl>
        </Section>

        {/* ===== Phiếu thu ===== */}
        <Section
          title="Phiếu thu"
          note="Cũ trước, mới sau"
        >
          {inv.payments.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">
              {b.status === "checked_in"
                ? "Chưa thu. Thu khi trả phòng hoặc thu tạm ứng trước."
                : "Chưa có phiếu thu nào."}
            </p>
          ) : (
            <ul>
              {inv.payments.map((p) => (
                <PaymentLine
                  key={p.id}
                  payment={p}
                  action={
                    p.can_void ? (
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "void", payment: p })}
                        className="whitespace-nowrap rounded-[7px] px-2 py-1 text-[12px] font-medium text-room-occupied hover:bg-[#F8E4DF]"
                      >
                        Huỷ phiếu
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}

          {activeCount > 0 && !can("void_payment") && (
            <p className="mt-3 flex items-start gap-2 rounded-[8px] border border-line-soft bg-cream-50 px-3 py-2 text-[11.5px] text-ink-muted">
              <Lock
                size={13}
                className="mt-px shrink-0"
                aria-hidden="true"
              />
              Thu nhầm? Báo quản lý huỷ phiếu. Lễ tân thu tiền và in hoá đơn được,
              không huỷ được phiếu thu.
            </p>
          )}
        </Section>
      </div>

      {/* ===== Hộp thoại ===== */}
      {dialog?.kind === "collect" && (
        <CollectPaymentDialog
          invoice={inv}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === "void" && (
        <VoidPaymentDialog
          invoice={inv}
          payment={dialog.payment}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === "print" && (
        <InvoicePrint
          invoice={inv}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/* ============================ Mảnh nhỏ ============================ */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line-soft px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {note && <span className="text-[11.5px] text-ink-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Line({
  title,
  sub,
  amount,
}: {
  title: string;
  sub: string;
  amount: number;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-dashed border-line-soft py-2 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">
          {title}
        </span>
        <span className="block truncate text-[11.5px] tabular-nums text-ink-faint">
          {sub}
        </span>
      </span>
      <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-ink">
        {formatAmount(amount)}
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  red = false,
}: {
  label: string;
  value: string;
  red?: boolean;
}) {
  return (
    <div className="border-r border-line-soft px-5 py-3 last:border-r-0">
      <p className="whitespace-nowrap text-[12px] text-ink-muted">{label}</p>
      <p
        className={`mt-0.5 whitespace-nowrap text-[19px] font-bold tabular-nums ${red ? "text-room-occupied" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function CloseButton({ onClose, dark }: { onClose: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Đóng chi tiết"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${
        dark
          ? "bg-white/10 text-white hover:bg-white/20"
          : "text-ink-muted hover:bg-segment"
      }`}
    >
      <X size={16} />
    </button>
  );
}
