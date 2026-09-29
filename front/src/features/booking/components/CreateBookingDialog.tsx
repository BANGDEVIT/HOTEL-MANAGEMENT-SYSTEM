import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Search, Star, UserPlus } from "lucide-react";
import { bookingApi } from "../../../api/bookingApi";
import { customerApi } from "../../../api/customerApi";
import { errorMessage } from "../../../utils/errorMessage";
import CustomerFormDialog from "../../customer/components/CustomerFormDialog";
import {
  ID_TYPE_LABELS,
  type CustomerListItem,
  type IdType,
} from "../../../types/customer";
import type {
  AvailableRoom,
  BookingDetail,
  BookingQuote,
} from "../../../types/booking";
import {
  addDays,
  avatarColor,
  formatAmount,
  formatPhone,
  formatRange,
  initialsOfFullName,
  nightsBetween,
  normalizeIdCard,
  todayYmd,
} from "../utils/format";
import { idCardError } from "./CheckInDialog";
import {
  BTN_GOLD,
  BTN_PRIMARY,
  BTN_SECONDARY,
  DialogShell,
  Field,
  INPUT,
  LINK_BTN,
  Segmented,
  Stepper,
} from "./ui";

interface Props {
  /** Mở từ hồ sơ khách: điền sẵn khách, vào thẳng bước 2 */
  initialCustomerId?: string;
  onClose: () => void;
  onCreated: (booking: BookingDetail) => void;
}

type Step = 1 | 2 | 3;
const MAX_NIGHTS = 30;
const MAX_GUESTS = 10;

/** Lỗi ngày giống luật BE, báo ngay trên form thay vì đợi BE trả 400 */
function datesError(
  checkIn: string,
  checkOut: string,
  today: string,
): string | null {
  if (!checkIn || !checkOut) return "Chọn ngày nhận và trả phòng";
  if (checkIn < today) return "Ngày nhận phòng không được ở quá khứ";
  if (checkOut <= checkIn) return "Ngày trả phòng phải sau ngày nhận phòng";
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS)
    return `Mỗi lần đặt tối đa ${MAX_NIGHTS} đêm`;
  return null;
}

/**
 * Tạo đặt phòng tại quầy, 3 bước: Khách → Ngày & phòng → Xác nhận.
 * Cột phải là bản tóm tắt luôn hiện, đổi gì ở bên trái thấy ngay ở bên phải.
 * Toàn bộ state nằm ở component này; mỗi bước là 1 component con chỉ nhận props.
 */
export default function CreateBookingDialog({
  initialCustomerId,
  onClose,
  onCreated,
}: Props) {
  const today = todayYmd();

  const [step, setStep] = useState<Step>(initialCustomerId ? 2 : 1);
  const [customer, setCustomer] = useState<CustomerListItem | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState("");

  const [note, setNote] = useState("");
  const [checkInNow, setCheckInNow] = useState(false);
  const [idType, setIdType] = useState<IdType | "">("cccd");
  const [idCard, setIdCard] = useState("");
  const [busy, setBusy] = useState(false);

  /* ----- Khách điền sẵn từ URL ----- */
  useEffect(() => {
    if (!initialCustomerId) return;
    let cancelled = false;
    customerApi
      .detail(initialCustomerId)
      .then((c) => !cancelled && setCustomer(c))
      .catch((err) => {
        if (cancelled) return;
        toast.error(errorMessage(err, "Không tải được khách, chọn lại khách"));
        setStep(1);
      });
    return () => {
      cancelled = true;
    };
  }, [initialCustomerId]);

  /* ----- Phòng trống: tải lại khi đổi ngày / số khách ----- */
  const dateErr = datesError(checkIn, checkOut, today);
  const guests = adults + children;
  const roomsKey = `${checkIn}|${checkOut}|${guests}`;
  const [roomsResult, setRoomsResult] = useState<{
    key: string;
    rooms: AvailableRoom[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (dateErr) return;
    let cancelled = false;
    bookingApi
      .availableRooms({
        check_in_date: checkIn,
        check_out_date: checkOut,
        capacity: guests,
      })
      .then((rooms) => !cancelled && setRoomsResult({ key: roomsKey, rooms }))
      .catch(
        (err) =>
          !cancelled &&
          setRoomsResult({
            key: roomsKey,
            rooms: [],
            error: errorMessage(err, "Không tải được phòng trống"),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [roomsKey, dateErr, checkIn, checkOut, guests]);

  // Kết quả cũ (khác key) coi như đang tải -> không cần setLoading(true) trong effect
  const roomsLoading = !dateErr && roomsResult?.key !== roomsKey;
  const rooms = roomsResult?.key === roomsKey ? roomsResult.rooms : [];
  // Phòng đã chọn không còn trong kết quả mới (đổi ngày) -> coi như chưa chọn
  const room = rooms.find((r) => r.id === roomId) ?? null;

  /* ----- Báo giá ở bước 3 (BE kiểm tra lại phòng còn trống không) ----- */
  const quoteKey = room ? `${room.id}|${roomsKey}` : "";
  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    quote?: BookingQuote;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (step !== 3 || !room) return;
    let cancelled = false;
    bookingApi
      .quote({
        room_id: room.id,
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults,
        children,
      })
      .then((quote) => !cancelled && setQuoteResult({ key: quoteKey, quote }))
      .catch(
        (err) =>
          !cancelled &&
          setQuoteResult({
            key: quoteKey,
            error: errorMessage(err, "Không kiểm tra được phòng"),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [step, room, quoteKey, checkIn, checkOut, adults, children]);

  const quote = quoteResult?.key === quoteKey ? quoteResult : null;

  /* ----- Nhận phòng luôn ----- */
  const canCheckInNow = checkIn === today;
  const needsId = checkInNow && canCheckInNow && !customer?.id_card_last4;
  const card = normalizeIdCard(idCard);
  const idErr = needsId ? idCardError(idType, card) : null;

  const nights = dateErr ? 0 : nightsBetween(checkIn, checkOut);
  const total = room ? room.room_type.base_price * nights : 0;

  const canNext =
    (step === 1 && !!customer) ||
    (step === 2 && !!customer && !!room && !dateErr) ||
    (step === 3 && !!quote?.quote?.available && !idErr);

  const submit = async () => {
    if (step < 3) {
      if (canNext) setStep((s) => (s + 1) as Step);
      return;
    }
    if (!customer || !room || !canNext) return;
    setBusy(true);
    try {
      const created = await bookingApi.create({
        customer_id: customer.id,
        room_id: room.id,
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults,
        children,
        note: note.trim() || undefined,
        check_in_now: checkInNow && canCheckInNow ? true : undefined,
        ...(needsId && { id_type: idType as IdType, id_card: card }),
      });
      toast.success(
        created.status === "checked_in"
          ? `Đã tạo ${created.code} và nhận phòng ${room.room_number}`
          : `Đã tạo đặt phòng ${created.code}`,
      );
      onCreated(created);
    } catch (err) {
      // 409 = phòng vừa bị người khác đặt: quay lại bước chọn phòng
      toast.error(errorMessage(err, "Không tạo được đặt phòng"));
      setBusy(false);
    }
  };

  const pickCustomer = (c: CustomerListItem) => {
    setCustomer(c);
    setShowCustomerForm(false);
    setStep(2);
  };

  return (
    <>
      <DialogShell
        title="Tạo đặt phòng"
        subtitle="Đặt tại quầy hoặc qua điện thoại. Tạo xong là đã xác nhận, không cần duyệt."
        width={920}
        busy={busy || showCustomerForm}
        onClose={onClose}
        onSubmit={() => void submit()}
        footer={
          <>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={busy}
                className={`${BTN_SECONDARY} mr-auto`}
              >
                ← {step === 2 ? "Đổi khách" : "Đổi phòng"}
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
              disabled={busy || !canNext}
              className={
                step === 3 && checkInNow && canCheckInNow ? BTN_GOLD : BTN_PRIMARY
              }
            >
              {busy
                ? "Đang tạo"
                : step === 1
                  ? "Tiếp: Chọn phòng"
                  : step === 2
                    ? "Tiếp: Xác nhận"
                    : checkInNow && canCheckInNow
                      ? "Tạo và nhận phòng"
                      : "Tạo đặt phòng"}
            </button>
          </>
        }
      >
        <StepBar step={step} />

        <div className="grid min-h-[440px] grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 border-r border-line px-6 py-5">
            {step === 1 && (
              <CustomerStep
                selected={customer}
                onPick={pickCustomer}
                onCreateNew={() => setShowCustomerForm(true)}
              />
            )}

            {step === 2 && (
              <RoomStep
                today={today}
                checkIn={checkIn}
                checkOut={checkOut}
                adults={adults}
                children={children}
                onCheckIn={(v) => {
                  setCheckIn(v);
                  if (v >= checkOut) setCheckOut(addDays(v, 1)); // giữ ngày trả luôn sau ngày nhận
                }}
                onCheckOut={setCheckOut}
                onAdults={setAdults}
                onChildren={setChildren}
                dateErr={dateErr}
                loading={roomsLoading}
                error={roomsResult?.key === roomsKey ? roomsResult.error : undefined}
                rooms={rooms}
                nights={nights}
                selectedId={room?.id ?? ""}
                onSelect={setRoomId}
              />
            )}

            {step === 3 && (
              <div className="grid gap-4">
                {!quote ? (
                  <p className="flex items-center gap-2 text-[13px] text-ink-muted">
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />{" "}
                    Đang kiểm tra lại phòng
                  </p>
                ) : quote.error || !quote.quote?.available ? (
                  <p
                    role="alert"
                    className="rounded-[10px] border border-room-occupied/30 bg-[#F8E4DF] px-4 py-3 text-[13px] text-room-occupied"
                  >
                    {quote.error ??
                      `Phòng ${room?.room_number} vừa có người đặt trong khoảng ngày này. Quay lại chọn phòng khác.`}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-room-available">
                    <Check
                      size={15}
                      strokeWidth={2.5}
                    />{" "}
                    Phòng {room?.room_number} vẫn còn trống, giá đã chốt
                  </p>
                )}

                <Field
                  label="Ghi chú cho lễ tân"
                  hint="VD: đến khoảng 20h, cần tầng cao, dị ứng lông vũ"
                >
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    rows={3}
                    className="w-full resize-none rounded-[10px] border border-line-input px-3 py-2.5 text-[13.5px] leading-relaxed focus:border-navy-700 focus:outline-none"
                  />
                </Field>

                <label
                  className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 ${
                    canCheckInNow
                      ? "cursor-pointer border-line hover:border-line-input"
                      : "cursor-not-allowed border-line-soft opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkInNow && canCheckInNow}
                    disabled={!canCheckInNow}
                    onChange={(e) => setCheckInNow(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-navy-700)]"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">
                      Nhận phòng luôn
                    </span>
                    <span className="block text-[12px] text-ink-muted">
                      {canCheckInNow
                        ? "Khách đang ở quầy: tạo xong nhận phòng ngay, mở hoá đơn, phòng chuyển sang có khách."
                        : "Chỉ bật được khi ngày nhận phòng là hôm nay."}
                    </span>
                  </span>
                </label>

                {needsId && (
                  <div className="grid grid-cols-[180px_1fr] gap-4 rounded-[12px] bg-cream-50 p-4">
                    <p className="col-span-2 text-[12.5px] text-ink-secondary">
                      Hồ sơ khách chưa có số giấy tờ. Nhận phòng bắt buộc có, hệ
                      thống lưu luôn vào hồ sơ.
                    </p>
                    <Field
                      label="Loại giấy tờ"
                      required
                    >
                      <Segmented
                        label="Loại giấy tờ"
                        value={idType}
                        onChange={setIdType}
                        options={(Object.keys(ID_TYPE_LABELS) as IdType[]).map(
                          (t) => ({ value: t, label: ID_TYPE_LABELS[t] }),
                        )}
                      />
                    </Field>
                    <Field
                      label="Số giấy tờ"
                      required
                      error={card.length >= 6 ? idErr : null}
                    >
                      <input
                        value={idCard}
                        onChange={(e) => setIdCard(e.target.value)}
                        placeholder={
                          idType === "passport" ? "VD: C1234567" : "12 chữ số"
                        }
                        className={`${INPUT} bg-white tabular-nums`}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>

          <Summary
            customer={customer}
            loadingCustomer={!!initialCustomerId && !customer && step !== 1}
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
            adults={adults}
            children={children}
            room={room}
            total={total}
          />
        </div>
      </DialogShell>

      {showCustomerForm && (
        <CustomerFormDialog
          target={{ mode: "create" }}
          onClose={() => setShowCustomerForm(false)}
          onSaved={(c) => pickCustomer(c)}
          onOpenExisting={(id) => {
            customerApi
              .detail(id)
              .then(pickCustomer)
              .catch((err) =>
                toast.error(errorMessage(err, "Không mở được hồ sơ khách")),
              );
          }}
        />
      )}
    </>
  );
}

/* ============================ Thanh bước ============================ */

const STEPS = ["Khách", "Ngày & phòng", "Xác nhận"];

function StepBar({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-3 border-b border-line bg-table-head px-6 py-3">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const on = n === step;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2 last:flex-none"
            aria-current={on ? "step" : undefined}
          >
            <span
              className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                done
                  ? "border-room-available bg-room-available/10 text-room-available"
                  : on
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-line-input bg-white text-ink-faint"
              }`}
            >
              {done ? (
                <Check
                  size={12}
                  strokeWidth={3}
                />
              ) : (
                n
              )}
            </span>
            <span
              className={`whitespace-nowrap text-[12.5px] ${
                on
                  ? "font-semibold text-navy-700"
                  : done
                    ? "text-room-available"
                    : "text-ink-faint"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className="mx-2 h-px flex-1 bg-line"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ============================ Bước 1: Khách ============================ */

function CustomerStep({
  selected,
  onPick,
  onCreateNew,
}: {
  selected: CustomerListItem | null;
  onPick: (c: CustomerListItem) => void;
  onCreateNew: () => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    q: string;
    items: CustomerListItem[];
  } | null>(null);
  const q = text.trim();

  // Gõ xong 300ms mới tìm. setState chỉ trong callback (timeout / promise), không chạy đồng bộ trong effect
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      customerApi
        .list({
          page: 1,
          limit: 8,
          search: q,
          nationality: "",
          membership: "all",
          stay: [],
          sort: "created_at",
          order: "desc",
        })
        .then((res) => !cancelled && setResult({ q, items: res.data }))
        .catch(() => !cancelled && setResult({ q, items: [] }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const searching = q.length >= 2 && result?.q !== q;
  const items = q.length >= 2 && result?.q === q ? result.items : [];

  return (
    <div className="grid gap-3">
      <label className="relative">
        <span className="sr-only">Tìm khách</span>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="Tìm theo tên, số điện thoại hoặc số giấy tờ"
          className={`${INPUT} bg-cream-50 pl-9`}
        />
      </label>

      {q.length < 2 ? (
        <p className="text-[12.5px] text-ink-faint">
          Nhập ít nhất 2 ký tự. Khách mới chưa có hồ sơ thì tạo hồ sơ trước.
        </p>
      ) : searching ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Loader2
            size={14}
            className="animate-spin"
          />{" "}
          Đang tìm
        </p>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">Không tìm thấy khách “{q}”.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((c) => (
            <li key={c.id}>
              <CustomerCard
                customer={c}
                selected={selected?.id === c.id}
                onClick={() => onPick(c)}
              />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onCreateNew}
        className={`${LINK_BTN} flex items-center gap-1.5 justify-self-start`}
      >
        <UserPlus size={14} /> Tạo hồ sơ khách mới
      </button>

      {selected && !items.some((c) => c.id === selected.id) && (
        <div className="mt-2">
          <p className="mb-1.5 text-[12px] text-ink-faint">Đang chọn</p>
          <CustomerCard
            customer={selected}
            selected
            onClick={() => onPick(selected)}
          />
        </div>
      )}
    </div>
  );
}

function CustomerCard({
  customer: c,
  selected,
  onClick,
}: {
  customer: CustomerListItem;
  selected: boolean;
  onClick: () => void;
}) {
  const color = avatarColor(c.id);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-left transition-colors ${
        selected
          ? "border-navy-700 bg-[#FBFCFE] shadow-[0_0_0_2px_rgba(27,58,92,.15)]"
          : "border-line hover:border-line-input"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
        style={{ background: color.bg, color: color.fg }}
        aria-hidden="true"
      >
        {initialsOfFullName(c.full_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
          <span className="truncate">{c.full_name}</span>
          {c.is_member && (
            <Star
              size={11}
              fill="var(--color-gold-500)"
              strokeWidth={0}
              aria-label="Thành viên"
            />
          )}
        </span>
        <span className="block truncate text-[12px] tabular-nums text-ink-muted">
          {formatPhone(c.phone) || "Chưa có SĐT"}
          {c.id_type
            ? ` · ${ID_TYPE_LABELS[c.id_type]} •••• ${c.id_card_last4 ?? ""}`
            : " · Chưa có giấy tờ"}
        </span>
      </span>
      <span className="shrink-0 text-right text-[11.5px] text-ink-faint">
        {c.stays ? `Đã ở ${c.stays} lần` : "Chưa ở lần nào"}
      </span>
    </button>
  );
}

/* ============================ Bước 2: Ngày & phòng ============================ */

function RoomStep(props: {
  today: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  onAdults: (v: number) => void;
  onChildren: (v: number) => void;
  dateErr: string | null;
  loading: boolean;
  error?: string;
  rooms: AvailableRoom[];
  nights: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const {
    today,
    checkIn,
    checkOut,
    adults,
    children,
    dateErr,
    loading,
    error,
    rooms,
    nights,
    selectedId,
    onSelect,
  } = props;

  // Nhóm theo loại phòng, loại rẻ trước
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { type: AvailableRoom["room_type"]; rooms: AvailableRoom[] }
    >();
    for (const r of rooms) {
      const g = map.get(r.room_type.id) ?? { type: r.room_type, rooms: [] };
      g.rooms.push(r);
      map.set(r.room_type.id, g);
    }
    return [...map.values()].sort((a, b) => a.type.base_price - b.type.base_price);
  }, [rooms]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1fr_1fr_110px_110px] gap-3">
        <Field
          label="Nhận phòng"
          required
        >
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => e.target.value && props.onCheckIn(e.target.value)}
            className={`${INPUT} tabular-nums`}
          />
        </Field>
        <Field
          label="Trả phòng"
          required
        >
          <input
            type="date"
            value={checkOut}
            min={addDays(checkIn, 1)}
            onChange={(e) => e.target.value && props.onCheckOut(e.target.value)}
            className={`${INPUT} tabular-nums`}
          />
        </Field>
        <Field label="Người lớn">
          <Stepper
            value={adults}
            min={1}
            max={MAX_GUESTS}
            onChange={props.onAdults}
            label="người lớn"
          />
        </Field>
        <Field label="Trẻ ≥ 6 tuổi">
          <Stepper
            value={children}
            min={0}
            max={MAX_GUESTS}
            onChange={props.onChildren}
            label="trẻ em"
          />
        </Field>
      </div>
      <p
        className={`-mt-2 text-[11.5px] ${dateErr ? "text-room-occupied" : "text-ink-faint"}`}
      >
        {dateErr ??
          `${nights} đêm · nhận 14:00, trả 12:00 · trẻ dưới 6 tuổi không tính vào sức chứa`}
      </p>

      {dateErr ? null : loading ? (
        <p className="flex items-center gap-2 py-6 text-[13px] text-ink-muted">
          <Loader2
            size={15}
            className="animate-spin"
          />{" "}
          Đang tìm phòng trống
        </p>
      ) : error ? (
        <p className="py-6 text-[13px] text-room-occupied">{error}</p>
      ) : groups.length === 0 ? (
        <p className="rounded-[10px] bg-cream-50 px-4 py-6 text-center text-[13px] text-ink-muted">
          Không còn phòng đủ {adults + children} khách trong khoảng ngày này. Thử đổi
          ngày hoặc giảm số khách.
        </p>
      ) : (
        <div className="grid max-h-[330px] gap-4 overflow-y-auto pr-1">
          {groups.map((g) => (
            <div key={g.type.id}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-faint">
                {g.type.name} · {formatAmount(g.type.base_price)} / đêm · tối đa{" "}
                {g.type.capacity}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {g.rooms.map((r) => {
                  const on = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onSelect(r.id)}
                      className={`rounded-[12px] border px-3 py-2.5 text-left transition-colors ${
                        on
                          ? "border-navy-700 bg-[#FBFCFE] shadow-[0_0_0_2px_rgba(27,58,92,.15)]"
                          : "border-line hover:border-line-input"
                      }`}
                    >
                      <span className="block text-[15px] font-semibold tabular-nums text-ink">
                        {r.room_number}
                      </span>
                      <span className="block text-[11.5px] text-ink-muted">
                        Tầng {r.floor}
                      </span>
                      {checkIn === today && r.status === "cleaning" ? (
                        <span className="mt-1 block text-[11px] text-room-cleaning">
                          Đang dọn, dọn xong mới nhận được
                        </span>
                      ) : checkIn === today && r.status === "occupied" ? (
                        <span className="mt-1 block text-[11px] text-room-cleaning">
                          Khách cũ trả phòng trước 12:00
                        </span>
                      ) : (
                        <span className="mt-1 block text-[12.5px] font-semibold tabular-nums text-ink">
                          {formatAmount(r.room_type.base_price * nights)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ Cột tóm tắt ============================ */

function Summary({
  customer,
  loadingCustomer,
  checkIn,
  checkOut,
  nights,
  adults,
  children,
  room,
  total,
}: {
  customer: CustomerListItem | null;
  loadingCustomer: boolean;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  room: AvailableRoom | null;
  total: number;
}) {
  const color = customer ? avatarColor(customer.id) : null;
  return (
    <aside
      aria-label="Tóm tắt đặt phòng"
      className="flex flex-col gap-3 bg-cream-50 px-5 py-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-faint">
        Tóm tắt
      </p>

      {customer && color ? (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-white px-3 py-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{ background: color.bg, color: color.fg }}
            aria-hidden="true"
          >
            {initialsOfFullName(customer.full_name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-ink">
              {customer.full_name}
            </span>
            <span className="block text-[11.5px] tabular-nums text-ink-muted">
              {formatPhone(customer.phone)}
              {customer.is_member && " · ★ Thành viên"}
            </span>
          </span>
        </div>
      ) : (
        <p className="rounded-[12px] border border-dashed border-line-input px-3 py-3 text-[12.5px] text-ink-faint">
          {loadingCustomer ? "Đang tải khách" : "Chưa chọn khách"}
        </p>
      )}

      <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 text-[12.5px]">
        <dt className="text-ink-muted">Phòng</dt>
        <dd className="text-ink">
          {room ? `${room.room_number} · ${room.room_type.name}` : "—"}
        </dd>
        <dt className="text-ink-muted">Ngày</dt>
        <dd className="tabular-nums text-ink">
          {nights ? formatRange(checkIn, checkOut) : "—"}
        </dd>
        <dt className="text-ink-muted">Số đêm</dt>
        <dd className="tabular-nums text-ink">{nights || "—"}</dd>
        <dt className="text-ink-muted">Số khách</dt>
        <dd className="text-ink">
          {adults} người lớn{children ? `, ${children} trẻ em` : ""}
        </dd>
      </dl>

      <div className="mt-auto border-t border-line pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-ink-muted">Tiền phòng</span>
          <span className="text-[20px] font-bold tabular-nums text-navy-900">
            {room ? formatAmount(total) : "—"}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] text-ink-faint">
          Không đặt cọc. Dịch vụ và giảm giá tính khi trả phòng.
        </p>
      </div>
    </aside>
  );
}
