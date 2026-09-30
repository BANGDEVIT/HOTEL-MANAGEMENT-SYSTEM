import { useState } from "react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { invoiceApi } from "../../../api/invoiceApi";
import { errorMessage } from "../../../utils/errorMessage";
import {
  MIN_PAYMENT,
  NEEDS_REFERENCE,
  type InvoiceDetail,
  type PaymentMethod,
} from "../../../types/invoice";
import {
  formatAmount,
  formatMoney,
  METHOD_META,
  METHODS,
  parseMoneyInput,
} from "../utils/invoiceMeta";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT } from "../../booking/components/styles";
import { DialogShell, Field } from "../../booking/components/ui";

interface Props {
  invoice: InvoiceDetail;
  onClose: () => void;
  onDone: (next: InvoiceDetail) => void;
}

/**
 * Thu tiền cho 1 hoá đơn:
 *   - Khách đang ở: "Thu tạm ứng" (thu trước 1 phần, phần còn lại thu lúc trả phòng)
 *   - Đã trả phòng mà còn thiếu: "Thu nợ"
 * Mặc định điền đủ số còn thiếu. Kiểm tra giống BE để báo lỗi ngay, BE vẫn kiểm tra lại.
 */
export default function CollectPaymentDialog({
  invoice: inv,
  onClose,
  onDone,
}: Props) {
  const debt = inv.is_debt;
  const [amountText, setAmountText] = useState(formatAmount(inv.remaining));
  const [method, setMethod] = useState<PaymentMethod>(
    debt ? "bank_transfer" : "cash",
  );
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const amount = parseMoneyInput(amountText);
  const needsRef = NEEDS_REFERENCE.includes(method);

  const amountError =
    amount < MIN_PAYMENT
      ? `Số tiền tối thiểu ${formatMoney(MIN_PAYMENT)}`
      : amount > inv.remaining
        ? `Không được vượt quá số còn thiếu ${formatMoney(inv.remaining)}`
        : null;
  const refError =
    needsRef && !reference.trim() ? "Nhập mã giao dịch để đối soát sao kê" : null;

  const after = inv.remaining - amount;

  // Gợi ý nhanh: thu đủ; khách đang ở thì thêm mức 50% (làm tròn 100.000đ)
  const half = Math.round(inv.remaining / 2 / 100_000) * 100_000;
  const chips = [
    { label: `Thu đủ ${formatMoney(inv.remaining)}`, value: inv.remaining },
    ...(!debt && half >= MIN_PAYMENT && half < inv.remaining
      ? [{ label: formatMoney(half), value: half }]
      : []),
  ];

  const submit = async () => {
    setTouched(true);
    if (amountError || refError) return;
    setBusy(true);
    try {
      const next = await invoiceApi.collect({
        invoice_id: inv.id,
        amount,
        payment_method: method,
        reference_number:
          method === "cash" ? undefined : reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(
        next.remaining > 0
          ? `Đã thu ${formatMoney(amount)}, còn thiếu ${formatMoney(next.remaining)}`
          : `Đã thu ${formatMoney(amount)}, hoá đơn ${next.code} đã đủ`,
      );
      onDone(next);
    } catch (err) {
      toast.error(errorMessage(err, "Không thu tiền được"));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={debt ? "Thu nợ" : "Thu tạm ứng"}
      subtitle={`${inv.code} · ${inv.customer.full_name} · Phòng ${inv.rooms.map((r) => r.room_number).join(", ")}${
        debt ? " · đã trả phòng" : ""
      }`}
      width={540}
      busy={busy}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={BTN_SECONDARY}
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={busy}
            className={BTN_PRIMARY}
          >
            {busy ? "Đang thu" : `Thu ${amount ? formatMoney(amount) : ""}`}
          </button>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5">
        {/* Phải trả / Đã thu / Còn thiếu */}
        <div className="grid grid-cols-3 overflow-hidden rounded-[12px] border border-line tabular-nums">
          <Cell
            label="Phải trả"
            value={formatMoney(inv.final_amount)}
          />
          <Cell
            label="Đã thu"
            value={formatMoney(inv.paid_amount)}
          />
          <Cell
            label="Còn thiếu"
            value={formatMoney(inv.remaining)}
            red={debt}
          />
        </div>

        <Field
          label="Số tiền thu"
          required
          error={touched ? amountError : null}
        >
          <div className="relative">
            <input
              value={amountText}
              inputMode="numeric"
              autoFocus
              onChange={(e) => {
                const n = parseMoneyInput(e.target.value);
                setAmountText(n ? formatAmount(n) : "");
              }}
              onFocus={(e) => e.target.select()}
              aria-invalid={touched && !!amountError}
              className={`${INPUT} h-12 pr-9 text-[20px] font-semibold tabular-nums`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">
              đ
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setAmountText(formatAmount(c.value))}
                className={`h-7 rounded-full border px-3 text-[12px] tabular-nums ${
                  amount === c.value
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-line-input bg-white text-ink hover:border-navy-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Phương thức"
          required
        >
          <div
            role="radiogroup"
            aria-label="Phương thức"
            className="grid grid-cols-4 gap-1.5"
          >
            {METHODS.map((m) => {
              const { label, icon: Icon } = METHOD_META[m];
              const on = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMethod(m)}
                  className={`flex h-[58px] flex-col items-center justify-center gap-1 rounded-[10px] border text-[12.5px] ${
                    on
                      ? "border-navy-700 bg-cream-50 font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
                      : "border-line-input bg-white text-ink-muted hover:border-navy-700"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        {method !== "cash" && (
          <Field
            label="Mã giao dịch"
            required={needsRef}
            error={touched ? refError : null}
            hint={
              needsRef
                ? "Bắt buộc với chuyển khoản / ví điện tử"
                : "Mã trên hoá đơn máy POS, không bắt buộc"
            }
          >
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value.slice(0, 100))}
              placeholder={
                method === "bank_transfer"
                  ? "VD FT26093012345"
                  : method === "e_wallet"
                    ? "VD MOMO8693845325"
                    : "VD POS2609301234"
              }
              aria-invalid={touched && !!refError}
              className={`${INPUT} tabular-nums`}
            />
          </Field>
        )}

        <Field label="Ghi chú">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder={
              debt
                ? "VD Khách chuyển lại sau khi ví hoàn tiền"
                : "VD Tạm ứng trước 2 đêm"
            }
            className={INPUT}
          />
        </Field>

        {!amountError && (
          <p className="flex items-center gap-2 rounded-[10px] bg-[#E2F1EA] px-3.5 py-2.5 text-[12.5px] text-[#0F5139]">
            <CircleCheck
              size={15}
              className="shrink-0"
              aria-hidden="true"
            />
            <span>
              {after > 0 ? (
                <>
                  Sau khi thu: hoá đơn <b className="font-semibold">Thu một phần</b>,
                  còn thiếu{" "}
                  <b className="font-semibold tabular-nums">{formatMoney(after)}</b>
                  {debt ? " (vẫn là công nợ)." : ", thu nốt lúc trả phòng."}
                </>
              ) : (
                <>
                  Sau khi thu: hoá đơn <b className="font-semibold">Đã thu đủ</b>
                  {debt
                    ? ", hết công nợ."
                    : ". Lúc trả phòng không phải thu thêm (trừ dịch vụ phát sinh)."}
                </>
              )}
              {inv.customer.email && " Khách sẽ nhận biên nhận qua email."}
            </span>
          </p>
        )}
      </div>
    </DialogShell>
  );
}

function Cell({
  label,
  value,
  red = false,
}: {
  label: string;
  value: string;
  red?: boolean;
}) {
  return (
    <div className="border-r border-line-soft px-3.5 py-2.5 last:border-r-0">
      <p className="text-[11.5px] text-ink-muted">{label}</p>
      <p
        className={`mt-0.5 whitespace-nowrap text-[15px] font-semibold ${red ? "text-room-occupied" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
