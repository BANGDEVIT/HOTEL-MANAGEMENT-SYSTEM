import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { bookingApi } from "../../../api/bookingApi";
import { errorMessage } from "../../../utils/errorMessage";
import {
  PAYMENT_METHOD_LABELS,
  POINT_UNIT,
  type BookingDetail,
  type PaymentMethod,
} from "../../../types/booking";
import { formatAmount } from "../utils/format";
import { bookingSubtitle } from "./BookingActionDialogs";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DialogShell,
  Field,
  INPUT,
  LINK_BTN,
  Segmented,
} from "./ui";

interface Props {
  booking: BookingDetail;
  onClose: () => void;
  onDone: (next: BookingDetail) => void;
  /** Có thì hiện nút "Thêm dịch vụ" (phụ thu trả muộn...) trước khi chốt */
  onAddService?: () => void;
}

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

/**
 * Trả phòng: xem lại hoá đơn -> chọn hình thức -> thu đúng số còn lại.
 * Số tiền hiện ở đây là SỐ BE ĐANG CÓ; BE tính lại lần cuối khi chốt nên không lệch.
 */
export default function CheckOutDialog({
  booking: b,
  onClose,
  onDone,
  onAddService,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const invoice = b.invoice;
  const finalAmount = invoice?.final_amount ?? b.room_total + b.service_total;
  const due = Math.max(0, finalAmount - (invoice?.paid_amount ?? 0));
  const points = b.customer.is_member ? Math.floor(finalAmount / POINT_UNIT) : 0;

  const submit = async () => {
    setBusy(true);
    try {
      const next = await bookingApi.checkOut(b.id, {
        payment_method: method,
        reference_number:
          method === "cash" ? undefined : reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(
        `Đã trả phòng ${b.room?.room_number ?? ""}${next.points_earned ? `, cộng ${next.points_earned} điểm cho khách` : ""}`,
      );
      onDone(next);
    } catch (err) {
      toast.error(errorMessage(err, "Không trả phòng được"));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={`Trả phòng · ${b.room?.room_number ?? ""}`}
      subtitle={bookingSubtitle(b)}
      width={560}
      busy={busy}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          {onAddService && (
            <button
              type="button"
              onClick={onAddService}
              disabled={busy}
              className={`${LINK_BTN} mr-auto`}
            >
              + Thêm dịch vụ / phụ thu
            </button>
          )}
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
            autoFocus
            className={BTN_PRIMARY}
          >
            {busy
              ? "Đang xử lý"
              : due > 0
                ? `Thu ${formatAmount(due)} và trả phòng`
                : "Trả phòng"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5">
        {/* ----- Hoá đơn chi tiết ----- */}
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
          <dt className="text-ink-muted">
            Tiền phòng · {b.nights} đêm ×{" "}
            {formatAmount(b.room?.price_per_night ?? 0)}
          </dt>
          <dd className="text-right tabular-nums">{formatAmount(b.room_total)}</dd>
          {b.services.map((s) => (
            <Line
              key={s.id}
              label={`${s.name} × ${s.quantity}`}
              value={formatAmount(s.total_price)}
            />
          ))}
          {!!invoice?.discount && (
            <>
              <dt className="text-ink-muted">Giảm giá</dt>
              <dd className="text-right tabular-nums text-room-available">
                −{formatAmount(invoice.discount)}
              </dd>
            </>
          )}
          {!!invoice?.paid_amount && (
            <>
              <dt className="text-ink-muted">Đã thu trước</dt>
              <dd className="text-right tabular-nums">
                −{formatAmount(invoice.paid_amount)}
              </dd>
            </>
          )}
          <dt className="mt-1 border-t border-line pt-2 text-[14.5px] font-semibold text-ink">
            Khách cần thanh toán
          </dt>
          <dd className="mt-1 border-t border-line pt-2 text-right text-[18px] font-bold tabular-nums text-navy-900">
            {formatAmount(due)}
          </dd>
        </dl>

        {due > 0 && (
          <>
            <Field
              label="Hình thức thanh toán"
              required
            >
              <Segmented
                label="Hình thức thanh toán"
                value={method}
                onChange={setMethod}
                options={METHODS.map((m) => ({
                  value: m,
                  label: PAYMENT_METHOD_LABELS[m],
                }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Mã giao dịch"
                hint={
                  method === "cash"
                    ? "Tiền mặt không cần mã"
                    : "Để đối soát sao kê sau này"
                }
              >
                <input
                  value={method === "cash" ? "" : reference}
                  onChange={(e) => setReference(e.target.value.slice(0, 100))}
                  disabled={method === "cash"}
                  placeholder={method === "cash" ? "—" : "VD: VCB2609301122"}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="Ghi chú thanh toán">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 300))}
                  className={INPUT}
                />
              </Field>
            </div>
          </>
        )}

        {points > 0 && (
          <p className="flex items-center gap-2 rounded-[10px] bg-gold-50 px-3.5 py-2.5 text-[12.5px] text-gold-700">
            <Star
              size={14}
              fill="currentColor"
              strokeWidth={0}
            />
            Khách là thành viên, được cộng{" "}
            <b className="font-semibold">+{points.toLocaleString("vi-VN")} điểm</b>{" "}
            (10.000đ = 1 điểm)
          </p>
        )}

        <p className="text-[11.5px] text-ink-faint">
          Sau khi trả phòng, phòng {b.room?.room_number} chuyển sang{" "}
          <b className="font-semibold">Đang dọn</b>. Trả phòng sớm vẫn tính đủ số đêm
          đã đặt.
        </p>
      </div>
    </DialogShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}
