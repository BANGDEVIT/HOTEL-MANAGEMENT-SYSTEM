/**
 * Các hộp thoại thao tác NGẮN (1–3 ô nhập): duyệt / không đến, từ chối / huỷ, thêm dịch vụ, giảm giá.
 * Nhận phòng và trả phòng dài hơn nên nằm file riêng.
 *
 * Quy ước chung:
 *   - Mỗi hộp thoại tự gọi API, lỗi thì toast và GIỮ hộp thoại mở để sửa.
 *   - Thành công: toast + onDone(chi tiết mới BE trả về) -> drawer thay dữ liệu, trang tải lại danh sách.
 *   - Form 1–3 ô dùng useState; kiểm tra đơn giản ngay trong hàm submit.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { bookingApi } from "../../../api/bookingApi";
import { errorMessage } from "../../../utils/errorMessage";
import type { BookingDetail, ServiceOption } from "../../../types/booking";
import { UNIT_LABELS } from "../../../types/service";
import { bookingSubtitle, formatAmount } from "../utils/format";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT } from "./styles";
import { DialogShell, Field, Stepper } from "./ui";

interface BaseProps {
  booking: BookingDetail;
  onClose: () => void;
  onDone: (next: BookingDetail) => void;
}

/** Gọi API + toast + báo drawer. Dùng chung cho mọi hộp thoại */
async function runAction(
  fn: () => Promise<BookingDetail>,
  success: string,
  fallbackError: string,
  onDone: (b: BookingDetail) => void,
): Promise<boolean> {
  try {
    const next = await fn();
    toast.success(success);
    onDone(next);
    return true;
  } catch (err) {
    toast.error(errorMessage(err, fallbackError));
    return false;
  }
}

/* ============================ Xác nhận 1 bước ============================ */

export function ConfirmActionDialog({
  booking,
  title,
  message,
  confirmLabel,
  successMessage,
  danger = false,
  run,
  onClose,
  onDone,
}: BaseProps & {
  title: string;
  message: string;
  confirmLabel: string;
  successMessage: string;
  danger?: boolean;
  run: () => Promise<BookingDetail>;
}) {
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = await runAction(
      run,
      successMessage,
      `Không thể ${confirmLabel.toLowerCase()}`,
      onDone,
    );
    if (!ok) setBusy(false);
  };

  return (
    <DialogShell
      title={title}
      subtitle={bookingSubtitle(booking)}
      width={460}
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
            Quay lại
          </button>
          <button
            type="submit"
            disabled={busy}
            autoFocus
            className={danger ? BTN_DANGER : BTN_PRIMARY}
          >
            {busy ? "Đang xử lý" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="px-6 py-5 text-[13.5px] leading-relaxed text-ink">{message}</p>
    </DialogShell>
  );
}

/* ============================ Từ chối / Huỷ ============================ */

const QUICK_REASONS: Record<"reject" | "cancel", string[]> = {
  reject: [
    "Hết phòng phù hợp",
    "Phòng đang sửa chữa",
    "Không liên lạc được khách",
    "Thông tin đặt phòng không hợp lệ",
  ],
  cancel: ["Khách gọi huỷ", "Khách đổi lịch", "Đặt trùng", "Phòng gặp sự cố"],
};

export function ReasonDialog({
  booking,
  mode,
  onClose,
  onDone,
}: BaseProps & { mode: "reject" | "cancel" }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isReject = mode === "reject";

  const submit = async () => {
    const text = reason.trim();
    if (text.length < 3) {
      setError("Lý do tối thiểu 3 ký tự");
      return;
    }
    setBusy(true);
    const ok = await runAction(
      () =>
        isReject
          ? bookingApi.reject(booking.id, text)
          : bookingApi.cancel(booking.id, text),
      isReject ? "Đã từ chối yêu cầu" : "Đã huỷ đặt phòng",
      isReject ? "Không từ chối được yêu cầu" : "Không huỷ được đặt phòng",
      onDone,
    );
    if (!ok) setBusy(false);
  };

  return (
    <DialogShell
      title={isReject ? "Từ chối yêu cầu" : "Huỷ đặt phòng"}
      subtitle={bookingSubtitle(booking)}
      width={500}
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
            Quay lại
          </button>
          <button
            type="submit"
            disabled={busy}
            className={BTN_DANGER}
          >
            {busy ? "Đang xử lý" : isReject ? "Từ chối yêu cầu" : "Huỷ đặt phòng"}
          </button>
        </>
      }
    >
      <div className="px-6 py-5">
        <Field
          label="Lý do"
          required
          error={error}
          hint={
            isReject
              ? "Khách thấy lý do này trong lịch sử đặt phòng của mình."
              : "Lưu vào lịch sử để tra lại sau."
          }
        >
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS[mode].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reason === r}
                onClick={() => {
                  setReason(r);
                  setError(null);
                }}
                className={`h-8 rounded-full border px-3 text-[12.5px] transition-colors ${
                  reason === r
                    ? "border-navy-700 bg-[#E4ECF6] font-medium text-navy-700"
                    : "border-line bg-white text-ink hover:border-line-input"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value.slice(0, 300));
              setError(null);
            }}
            rows={3}
            autoFocus
            placeholder="Chọn lý do nhanh ở trên hoặc tự nhập"
            className="w-full resize-none rounded-[10px] border border-line-input px-3 py-2.5 text-[13.5px] leading-relaxed focus:border-navy-700 focus:outline-none"
          />
        </Field>
      </div>
    </DialogShell>
  );
}

/* ============================ Thêm dịch vụ ============================ */

export function AddServiceDialog({ booking, onClose, onDone }: BaseProps) {
  const [services, setServices] = useState<ServiceOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bookingApi
      .services()
      .then((list) => !cancelled && setServices(list))
      .catch(
        (err) =>
          !cancelled &&
          setLoadError(errorMessage(err, "Không tải được danh sách dịch vụ")),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const picked = services?.find((s) => s.id === serviceId);

  const submit = async () => {
    if (!picked) {
      setError("Chọn dịch vụ");
      return;
    }
    setBusy(true);
    const ok = await runAction(
      () =>
        bookingApi.addService(booking.id, {
          service_id: picked.id,
          quantity,
          note: note.trim() || undefined,
        }),
      `Đã thêm ${picked.name} × ${quantity} ${UNIT_LABELS[picked.unit]}`,
      "Không thêm được dịch vụ",
      onDone,
    );
    if (!ok) setBusy(false);
  };

  return (
    <DialogShell
      title="Thêm dịch vụ"
      subtitle={bookingSubtitle(booking)}
      width={520}
      busy={busy}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          {picked && (
            <span className="mr-auto text-[13px] tabular-nums text-ink-secondary">
              Thành tiền{" "}
              <b className="text-[15px] font-semibold text-ink">
                {formatAmount(picked.price * quantity)}
              </b>
            </span>
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
            disabled={busy || !services}
            className={BTN_PRIMARY}
          >
            {busy ? "Đang thêm" : "Thêm vào hoá đơn"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_140px] gap-4 px-6 py-5">
        <Field
          label="Dịch vụ"
          required
          error={error ?? loadError}
          className="col-span-2"
        >
          {services === null && !loadError ? (
            <p className="py-2 text-[13px] text-ink-muted">Đang tải dịch vụ</p>
          ) : services && services.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">
              Chưa có dịch vụ nào đang bán.
            </p>
          ) : (
            <div className="grid max-h-[240px] grid-cols-2 gap-2 overflow-y-auto">
              {services?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={serviceId === s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setError(null);
                  }}
                  className={`rounded-[10px] border px-3 py-2 text-left transition-colors ${
                    serviceId === s.id
                      ? "border-navy-700 bg-[#FBFCFE] shadow-[0_0_0_2px_rgba(27,58,92,.15)]"
                      : "border-line hover:border-line-input"
                  }`}
                >
                  <span className="block text-[13px] font-medium text-ink">
                    {s.name}
                  </span>
                  <span className="block text-[12px] tabular-nums text-ink-muted">
                    {formatAmount(s.price)} / {UNIT_LABELS[s.unit]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field
          label="Ghi chú"
          hint="VD: trả phòng muộn tới 15:00"
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            className={INPUT}
          />
        </Field>
        <Field
          label={picked ? `Số lượng (${UNIT_LABELS[picked.unit]})` : "Số lượng"}
        >
          <Stepper
            value={quantity}
            min={1}
            max={99}
            onChange={setQuantity}
            label="số lượng"
          />
        </Field>
      </div>
    </DialogShell>
  );
}

/* ============================ Giảm giá (quản lý) ============================ */

export function DiscountDialog({ booking, onClose, onDone }: BaseProps) {
  const invoice = booking.invoice;
  const [value, setValue] = useState(
    invoice?.discount ? String(invoice.discount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalAmount = invoice?.total_amount ?? 0;
  const discount = Number(value.replace(/\D/g, "")) || 0;

  const submit = async () => {
    if (discount > totalAmount) {
      setError(`Không được lớn hơn tổng hoá đơn ${formatAmount(totalAmount)}`);
      return;
    }
    setBusy(true);
    const ok = await runAction(
      () => bookingApi.setDiscount(booking.id, discount),
      discount ? `Đã giảm ${formatAmount(discount)}đ` : "Đã bỏ giảm giá",
      "Không lưu được giảm giá",
      onDone,
    );
    if (!ok) setBusy(false);
  };

  return (
    <DialogShell
      title="Giảm giá hoá đơn"
      subtitle={bookingSubtitle(booking)}
      width={440}
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
            {busy ? "Đang lưu" : "Lưu giảm giá"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5">
        <Field
          label="Số tiền giảm (đ)"
          error={error}
          hint="Nhập 0 để bỏ giảm giá. Chỉ quản lý thấy mục này."
        >
          <input
            value={discount ? formatAmount(discount) : value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, "").slice(0, 12));
              setError(null);
            }}
            inputMode="numeric"
            autoFocus
            placeholder="0"
            className={`${INPUT} text-right tabular-nums`}
          />
        </Field>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 rounded-[10px] bg-cream-50 px-4 py-3 text-[13px]">
          <dt className="text-ink-muted">Tổng hoá đơn</dt>
          <dd className="text-right tabular-nums">{formatAmount(totalAmount)}</dd>
          <dt className="text-ink-muted">Giảm</dt>
          <dd className="text-right tabular-nums text-room-available">
            −{formatAmount(Math.min(discount, totalAmount))}
          </dd>
          <dt className="border-t border-line pt-1.5 font-semibold">Khách trả</dt>
          <dd className="border-t border-line pt-1.5 text-right font-semibold tabular-nums">
            {formatAmount(Math.max(0, totalAmount - discount))}
          </dd>
        </dl>
      </div>
    </DialogShell>
  );
}
