import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { invoiceApi } from "../../../api/invoiceApi";
import { errorMessage } from "../../../utils/errorMessage";
import type { InvoiceDetail, InvoicePayment } from "../../../types/invoice";
import { formatMoney } from "../utils/invoiceMeta";
import { BTN_DANGER, BTN_SECONDARY, INPUT } from "../../booking/components/styles";
import { DialogShell, Field } from "../../booking/components/ui";
import { PaymentLine } from "./InvoiceBits";

interface Props {
  invoice: InvoiceDetail;
  payment: InvoicePayment;
  onClose: () => void;
  onDone: (next: InvoiceDetail) => void;
}

const REASONS = [
  "Nhập nhầm số tiền",
  "Chọn nhầm phương thức",
  "Thu trùng",
  "Chuyển khoản không về",
];

/**
 * Quản lý huỷ phiếu thu nhập nhầm. Phiếu KHÔNG bị xoá: BE ghi ai huỷ, lúc nào, lý do.
 * Cảnh báo nói rõ hậu quả bằng con số trước khi bấm.
 */
export default function VoidPaymentDialog({
  invoice: inv,
  payment: p,
  onClose,
  onDone,
}: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const error =
    reason.trim().length < 3
      ? "Ghi lý do (tối thiểu 3 ký tự) để sau này đối soát"
      : null;

  const remainingAfter = inv.remaining + p.amount;
  const paidAfter = inv.paid_amount - p.amount;
  const checkedOut = inv.booking.status === "checked_out";
  const statusAfter = paidAfter <= 0 ? "Chưa thu" : "Thu một phần";

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setBusy(true);
    try {
      const next = await invoiceApi.voidPayment(p.id, reason.trim());
      toast.success(`Đã huỷ phiếu thu ${formatMoney(p.amount)}`);
      onDone(next);
    } catch (err) {
      toast.error(errorMessage(err, "Không huỷ được phiếu thu"));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="Huỷ phiếu thu"
      subtitle={`${inv.code} · ${inv.customer.full_name}`}
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
            Giữ phiếu
          </button>
          <button
            type="submit"
            disabled={busy}
            className={BTN_DANGER}
          >
            {busy ? "Đang huỷ" : `Huỷ phiếu ${formatMoney(p.amount)}`}
          </button>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5">
        <ul className="rounded-[12px] border border-line px-3.5">
          <PaymentLine payment={p} />
        </ul>

        <div className="flex items-start gap-2.5 rounded-[12px] border border-[#EBC7BE] bg-[#FBF0ED] px-3.5 py-3 text-[#7A2616]">
          <AlertTriangle
            size={17}
            className="mt-px shrink-0"
            aria-hidden="true"
          />
          <div className="text-[12.5px] leading-relaxed">
            <p className="font-semibold">
              {checkedOut ? "Công nợ" : "Số còn phải thu"} sẽ tăng lên{" "}
              <span className="tabular-nums">{formatMoney(remainingAfter)}</span>
            </p>
            <p>
              Phiếu không bị xoá mà được đánh dấu đã huỷ, kèm tên bạn và lý do. Hoá
              đơn chuyển về "{statusAfter}".
              {checkedOut
                ? " Khách đã trả phòng nên cần thu lại bằng nút Thu nợ."
                : " Phần này sẽ thu lại lúc trả phòng."}
            </p>
          </div>
        </div>

        <Field
          label="Lý do huỷ"
          required
          error={touched ? error : null}
        >
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`h-7 rounded-full border px-3 text-[12px] ${
                  reason === r
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-line-input bg-white text-ink hover:border-navy-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={3}
            autoFocus
            placeholder="VD Chọn nhầm phương thức: khách quẹt thẻ, không trả tiền mặt"
            aria-invalid={touched && !!error}
            className={`${INPUT} h-auto resize-none py-2.5 leading-relaxed`}
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-ink-faint">
            {reason.length}/300
          </p>
        </Field>
      </div>
    </DialogShell>
  );
}
