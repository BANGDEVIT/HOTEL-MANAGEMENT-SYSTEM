import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  BedDouble,
  Check,
  LogIn,
  LogOut,
  Plus,
  Star,
  Trash2,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { bookingApi } from "../../../api/bookingApi";
import { errorMessage } from "../../../utils/errorMessage";
import {
  BOOKING_TYPE_LABELS,
  CHECK_IN_HOUR,
  CHECK_OUT_HOUR,
  PAYMENT_METHOD_LABELS,
  TIMELINE_LABELS,
  type BookingAction,
  type BookingDetail,
} from "../../../types/booking";
import {
  formatAmount,
  formatDateTime,
  formatDayMonth,
  formatGuests,
  formatMoney,
  formatPhone,
  formatTime,
} from "../utils/format";
import { StatusPill } from "./ui";
import {
  AddServiceDialog,
  ConfirmActionDialog,
  DiscountDialog,
  ReasonDialog,
} from "./BookingActionDialogs";
import CheckInDialog from "./CheckInDialog";
import CheckOutDialog from "./CheckOutDialog";

interface Props {
  opened: { id: string; intent?: BookingAction; seq: number } | null;
  onClose: () => void;
  /** Booking vừa đổi -> trang cha tải lại danh sách + số liệu */
  onChanged: () => void;
}

/**
 * Ngăn trượt bên phải. Khung ngoài LUÔN render (để có hiệu ứng trượt);
 * phần thân gắn key = seq -> mỗi lần mở là thân MỚI: tải lại chi tiết, state hộp thoại về mặc định.
 */
export default function BookingDrawer({ opened, onClose, onChanged }: Props) {
  const open = opened !== null;

  // Esc đóng drawer, TRỪ KHI đang có hộp thoại (hộp thoại tự lo phím Esc của nó)
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
      aria-label="Chi tiết đặt phòng"
      aria-hidden={!open}
      // Bóng đổ chỉ bật khi mở: đóng rồi mà vẫn đổ bóng thì mép phải màn hình bị một vệt xám
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
          intent={opened.intent}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </aside>
  );
}

/* ============================ Nút thao tác trên header ============================ */

/** Thứ tự hiển thị: nút phụ trước, nút chính (nền vàng) cuối cùng bên phải */
const HEADER_ACTIONS: {
  action: BookingAction;
  label: string;
  icon: LucideIcon;
  main?: boolean;
}[] = [
  { action: "reject", label: "Từ chối", icon: X },
  { action: "cancel", label: "Huỷ đặt phòng", icon: Ban },
  { action: "mark_no_show", label: "Không đến", icon: UserX },
  { action: "add_service", label: "Thêm dịch vụ", icon: Plus },
  { action: "confirm", label: "Duyệt yêu cầu", icon: Check, main: true },
  { action: "check_in", label: "Nhận phòng", icon: LogIn, main: true },
  { action: "check_out", label: "Trả phòng", icon: LogOut, main: true },
];

const ACTION_NAMES: Record<BookingAction, string> = {
  confirm: "duyệt",
  reject: "từ chối",
  cancel: "huỷ",
  check_in: "nhận phòng",
  mark_no_show: "đánh dấu không đến",
  add_service: "thêm dịch vụ",
  set_discount: "giảm giá",
  check_out: "trả phòng",
};

/* ============================ Thân drawer ============================ */

function DrawerBody({
  id,
  intent,
  onClose,
  onChanged,
}: {
  id: string;
  intent?: BookingAction;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<BookingAction | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Tải chi tiết. Có intent (bấm nút nhanh trên dòng) -> tải xong bật luôn hộp thoại,
  // nhưng CHỈ khi BE cho phép (allowed_actions). setState nằm trong .then, không chạy đồng bộ trong effect.
  useEffect(() => {
    let cancelled = false;
    bookingApi
      .detail(id)
      .then((d) => {
        if (cancelled) return;
        setBooking(d);
        if (!intent) return;
        if (d.allowed_actions.includes(intent)) setDialog(intent);
        else toast.info(`Booking ${d.code} hiện không thể ${ACTION_NAMES[intent]}`);
      })
      .catch(
        (err) =>
          !cancelled && setError(errorMessage(err, "Không tải được đặt phòng")),
      );
    return () => {
      cancelled = true;
    };
  }, [id, intent]);

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

  if (!booking) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="h-[230px] animate-pulse bg-navy-700" />
        <p className="py-10 text-center text-[13px] text-ink-muted">
          Đang tải đặt phòng
        </p>
      </div>
    );
  }

  const b = booking;
  const can = (a: BookingAction) => b.allowed_actions.includes(a);
  const headerActions = HEADER_ACTIONS.filter((a) => can(a.action));

  /** Mọi hộp thoại xong việc đều gọi hàm này với chi tiết MỚI do BE trả về */
  const done = (next: BookingDetail) => {
    setBooking(next);
    setDialog(null);
    onChanged();
  };

  const removeService = async (itemId: string) => {
    setRemoving(true);
    try {
      done(await bookingApi.removeService(b.id, itemId));
      toast.success("Đã xoá dịch vụ");
    } catch (err) {
      toast.error(errorMessage(err, "Không xoá được dịch vụ"));
    } finally {
      setRemoving(false);
      setConfirmRemoveId(null);
    }
  };

  const inHouse = b.status === "checked_in";
  const total = b.invoice ? b.invoice.final_amount : b.room_total;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ===== Header navy ===== */}
      <header className="bg-navy-700 px-5 pb-4 pt-4 text-white">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11.5px] text-on-navy-muted">
              {b.code} · {BOOKING_TYPE_LABELS[b.booking_type]}
            </p>
            <h2 className="mt-1 truncate font-display text-[22px] font-bold leading-tight">
              {b.customer.full_name}
            </h2>
            <p className="mt-0.5 text-[12.5px] tabular-nums text-on-navy-muted">
              {formatPhone(b.customer.phone) || "Chưa có SĐT"}
              {!b.customer_has_id_card &&
                b.status !== "checked_out" &&
                " · Chưa có giấy tờ"}
            </p>
          </div>
          <CloseButton
            onClose={onClose}
            dark
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white">
            <StatusPill status={b.status} />
          </span>
          {b.customer.is_member && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gold-500 px-2.5 py-1 text-[11.5px] font-semibold text-navy-900">
              <Star
                size={11}
                fill="currentColor"
                strokeWidth={0}
              />{" "}
              Thành viên
            </span>
          )}
          {b.is_overdue && (
            <span className="whitespace-nowrap rounded-full bg-[#F8E4DF] px-2.5 py-1 text-[11.5px] font-semibold text-room-occupied">
              Quá hạn
            </span>
          )}
        </div>

        {/* Nhận phòng — số đêm — Trả phòng */}
        <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] bg-white/6 px-3.5 py-2.5">
          <StayPoint
            label="Nhận phòng"
            date={formatDayMonth(b.check_in_date)}
            sub={
              b.timeline.find((t) => t.event === "checked_in")
                ? `${formatTime(b.timeline.find((t) => t.event === "checked_in")!.at)} đã nhận`
                : `từ ${CHECK_IN_HOUR}`
            }
          />
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] tabular-nums text-on-navy-muted">
            {b.nights} đêm
          </span>
          <StayPoint
            label="Trả phòng"
            date={formatDayMonth(b.check_out_date)}
            sub={
              b.timeline.find((t) => t.event === "checked_out")
                ? `${formatTime(b.timeline.find((t) => t.event === "checked_out")!.at)} đã trả`
                : `trước ${CHECK_OUT_HOUR}`
            }
            right
          />
        </div>

        {headerActions.length > 0 && (
          <div
            className={`mt-3 grid gap-1.5 ${headerActions.length === 1 ? "grid-cols-1" : headerActions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
          >
            {headerActions.map(({ action, label, icon: Icon, main }) => (
              <button
                key={action}
                type="button"
                onClick={() => setDialog(action)}
                className={`flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-2 text-[12.5px] ${
                  main
                    ? "bg-gold-500 font-semibold text-navy-900 hover:brightness-95"
                    : "bg-white/10 hover:bg-white/15"
                }`}
              >
                <Icon
                  size={14}
                  strokeWidth={2}
                />{" "}
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ===== 3 số liệu ===== */}
      <div className="grid grid-cols-3 border-b border-line">
        <Stat
          label="Phòng"
          value={b.room?.room_number ?? "—"}
        />
        <Stat
          label="Số khách"
          value={b.children ? `${b.adults} + ${b.children}` : String(b.adults)}
        />
        <Stat
          label={
            b.status === "checked_out"
              ? "Đã thanh toán"
              : b.invoice
                ? "Tạm tính"
                : "Tiền phòng"
          }
          value={formatAmount(total)}
          title={formatMoney(total)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ===== Lưu trú ===== */}
        <Section title="Lưu trú">
          <dl className="grid grid-cols-[96px_1fr] gap-y-2 text-[13px]">
            <dt className="text-ink-muted">Phòng</dt>
            <dd className="text-ink">
              {b.room
                ? `${b.room.room_number} · ${b.room.room_type} · tầng ${b.room.floor}`
                : "Chưa xếp phòng"}
            </dd>
            <dt className="text-ink-muted">Giá</dt>
            <dd className="tabular-nums text-ink">
              {b.room
                ? `${formatAmount(b.room.price_per_night)} / đêm (chốt lúc đặt)`
                : "—"}
            </dd>
            <dt className="text-ink-muted">Số khách</dt>
            <dd className="text-ink">
              {formatGuests(b.adults, b.children)}
              <span className="text-ink-faint"> · trẻ dưới 6 tuổi không tính</span>
            </dd>
            {b.note && (
              <>
                <dt className="text-ink-muted">Ghi chú</dt>
                <dd className="whitespace-pre-line text-ink">{b.note}</dd>
              </>
            )}
          </dl>
        </Section>

        {/* ===== Dịch vụ (khi khách đã nhận phòng) ===== */}
        {(inHouse || b.services.length > 0) && (
          <Section
            title="Dịch vụ đã dùng"
            action={
              can("add_service")
                ? { label: "+ Thêm", onClick: () => setDialog("add_service") }
                : undefined
            }
          >
            {b.services.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Chưa dùng dịch vụ nào.</p>
            ) : (
              <ul>
                {b.services.map((s) => (
                  <li
                    key={s.id}
                    className="border-b border-dashed border-line-soft py-2 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">
                          {s.name} × {s.quantity}
                        </p>
                        <p className="text-[11.5px] tabular-nums text-ink-faint">
                          {formatDateTime(s.used_at)}
                          {s.note && ` · ${s.note}`}
                        </p>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums text-ink">
                        {formatAmount(s.total_price)}
                      </span>
                      {can("add_service") && (
                        <button
                          type="button"
                          aria-label={`Xoá ${s.name}`}
                          onClick={() => setConfirmRemoveId(s.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-[#F8E4DF] hover:text-room-occupied"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {confirmRemoveId === s.id && (
                      <div className="mt-1.5 flex items-center justify-end gap-2 text-[12px]">
                        <span className="text-ink-secondary">
                          Xoá dịch vụ nhập nhầm này?
                        </span>
                        <button
                          type="button"
                          disabled={removing}
                          onClick={() => void removeService(s.id)}
                          className="font-semibold text-room-occupied disabled:opacity-50"
                        >
                          {removing ? "Đang xoá" : "Xoá"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-ink-muted"
                        >
                          Huỷ
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* ===== Hoá đơn ===== */}
        <Section
          title={
            b.invoice
              ? b.invoice.status === "paid"
                ? "Hoá đơn"
                : "Hoá đơn tạm tính"
              : "Tiền phòng dự kiến"
          }
          action={
            can("set_discount")
              ? { label: "Đặt giảm giá", onClick: () => setDialog("set_discount") }
              : undefined
          }
        >
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
            <dt className="text-ink-muted">
              Tiền phòng ({b.nights} đêm ×{" "}
              {formatAmount(b.room?.price_per_night ?? 0)})
            </dt>
            <dd className="text-right tabular-nums text-ink">
              {formatAmount(b.room_total)}
            </dd>
            {b.invoice && (
              <>
                <dt className="text-ink-muted">Dịch vụ</dt>
                <dd className="text-right tabular-nums text-ink">
                  {formatAmount(b.service_total)}
                </dd>
                <dt className="text-ink-muted">Giảm giá</dt>
                <dd className="text-right tabular-nums text-room-available">
                  {b.invoice.discount ? `−${formatAmount(b.invoice.discount)}` : "0"}
                </dd>
              </>
            )}
            <dt className="mt-1 border-t border-line pt-2 text-[14px] font-semibold text-ink">
              {b.invoice?.status === "paid"
                ? "Đã thanh toán"
                : b.invoice
                  ? "Phải trả khi trả phòng"
                  : "Tổng dự kiến"}
            </dt>
            <dd className="mt-1 border-t border-line pt-2 text-right text-[14px] font-semibold tabular-nums text-ink">
              {formatAmount(total)}
            </dd>
          </dl>
          {!b.invoice && ["pending", "confirmed"].includes(b.status) && (
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Hoá đơn mở khi nhận phòng. Không đặt cọc, thanh toán khi trả phòng.
            </p>
          )}
          {b.invoice?.payments.map((p) => (
            <p
              key={p.id}
              className="mt-2 flex items-center justify-between rounded-[8px] bg-cream-50 px-3 py-2 text-[12px] text-ink-secondary"
            >
              <span>
                {PAYMENT_METHOD_LABELS[p.payment_method]}
                {p.reference_number && (
                  <span className="font-mono"> · {p.reference_number}</span>
                )}
                <span className="block text-[11px] text-ink-faint">
                  {formatDateTime(p.paid_at)}
                  {p.received_by && ` · ${p.received_by}`}
                </span>
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {formatAmount(p.amount)}
              </span>
            </p>
          ))}
          {b.points_earned > 0 && (
            <p className="mt-2 flex items-center gap-1.5 rounded-[8px] bg-gold-50 px-3 py-2 text-[12px] text-gold-700">
              <Star
                size={12}
                fill="currentColor"
                strokeWidth={0}
              />{" "}
              Đã cộng {b.points_earned.toLocaleString("vi-VN")} điểm cho khách
            </p>
          )}
        </Section>

        {/* ===== Lịch sử ===== */}
        <Section title="Lịch sử">
          <ol className="relative ml-1.5 border-l border-line pl-4">
            {b.timeline.map((t, i) => {
              const bad =
                t.event === "rejected" ||
                t.event === "cancelled" ||
                t.event === "no_show";
              return (
                <li
                  key={`${t.event}-${i}`}
                  className="relative pb-3 last:pb-0"
                >
                  <span
                    className={`absolute -left-[22px] top-1 h-[11px] w-[11px] rounded-full border-2 bg-white ${
                      bad ? "border-room-occupied" : "border-gold-500"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-semibold text-ink">
                      {TIMELINE_LABELS[t.event]}
                    </p>
                    <p className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-faint">
                      {formatDateTime(t.at)}
                    </p>
                  </div>
                  <p className="text-[12px] text-ink-muted">
                    {t.by ?? (t.event === "created" ? "Khách tự đặt" : "Hệ thống")}
                  </p>
                  {t.reason && (
                    <p className="mt-1 rounded-[6px] bg-[#F8E4DF] px-2 py-1 text-[12px] text-room-occupied">
                      {t.reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      </div>

      {/* ===== Hộp thoại ===== */}
      {dialog === "confirm" && (
        <ConfirmActionDialog
          booking={b}
          title="Duyệt yêu cầu đặt phòng"
          message={`Giữ phòng ${b.room?.room_number ?? ""} cho ${b.customer.full_name} từ ${formatDayMonth(b.check_in_date)} đến ${formatDayMonth(b.check_out_date)}.`}
          confirmLabel="Duyệt yêu cầu"
          successMessage="Đã duyệt yêu cầu đặt phòng"
          run={() => bookingApi.confirm(b.id)}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog === "mark_no_show" && (
        <ConfirmActionDialog
          booking={b}
          title="Đánh dấu khách không đến"
          message="Phòng sẽ được nhả ra cho khách khác đặt. Thao tác này không hoàn tác được."
          confirmLabel="Đánh dấu không đến"
          danger
          successMessage="Đã đánh dấu khách không đến"
          run={() => bookingApi.markNoShow(b.id)}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {(dialog === "reject" || dialog === "cancel") && (
        <ReasonDialog
          booking={b}
          mode={dialog}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog === "add_service" && (
        <AddServiceDialog
          booking={b}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog === "set_discount" && (
        <DiscountDialog
          booking={b}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog === "check_in" && (
        <CheckInDialog
          booking={b}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog === "check_out" && (
        <CheckOutDialog
          booking={b}
          onClose={() => setDialog(null)}
          onDone={done}
          onAddService={
            can("add_service") ? () => setDialog("add_service") : undefined
          }
        />
      )}
    </div>
  );
}

/* ============================ Mảnh nhỏ ============================ */

function StayPoint({
  label,
  date,
  sub,
  right = false,
}: {
  label: string;
  date: string;
  sub: string;
  right?: boolean;
}) {
  return (
    <div className={right ? "text-right" : ""}>
      <p className="text-[10.5px] uppercase tracking-[.06em] text-on-navy-muted">
        {label}
      </p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums">{date}</p>
      <p className="text-[11px] tabular-nums text-on-navy-muted">{sub}</p>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line-soft px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[12.5px] font-medium text-navy-700 hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      className="border-r border-line px-5 py-3 last:border-r-0"
      title={title}
    >
      <p className="whitespace-nowrap text-[12px] text-ink-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[19px] font-bold tabular-nums text-ink">
        {label === "Phòng" && (
          <BedDouble
            size={15}
            className="text-ink-faint"
            aria-hidden="true"
          />
        )}
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
