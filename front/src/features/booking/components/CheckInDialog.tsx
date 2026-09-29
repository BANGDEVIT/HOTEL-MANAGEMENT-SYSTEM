import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { bookingApi } from "../../../api/bookingApi";
import { errorMessage } from "../../../utils/errorMessage";
import { ID_TYPE_LABELS, type IdType } from "../../../types/customer";
import type { AvailableRoom, BookingDetail } from "../../../types/booking";
import {
  bookingSubtitle,
  formatAmount,
  formatDayMonth,
  idCardError,
  normalizeIdCard,
  todayYmd,
} from "../utils/format";
import { BTN_GOLD, BTN_SECONDARY, BTN_SMALL, INPUT } from "./styles";
import { DialogShell, Field, Segmented } from "./ui";

interface Props {
  booking: BookingDetail;
  onClose: () => void;
  onDone: (next: BookingDetail) => void;
}

type RoomStatus = AvailableRoom["status"];

const ROOM_PROBLEM: Record<Exclude<RoomStatus, "available">, string> = {
  cleaning: "đang chờ dọn",
  occupied: "vẫn còn khách cũ, trả phòng và dọn xong mới nhận được",
  maintenance: "đang bảo trì",
  inactive: "đã ngừng kinh doanh",
};

/**
 * Nhận phòng = checklist 3 mục, đủ 3 mục xanh mới bấm được:
 *   1. Đúng ngày (BE đã kiểm tra qua allowed_actions, ở đây chỉ hiện ra cho lễ tân thấy)
 *   2. Phòng đang Trống. Đang dọn -> có nút "Đã dọn xong" ngay tại đây
 *   3. Có số giấy tờ. Hồ sơ chưa có thì nhập luôn, BE lưu vào hồ sơ khách
 */
export default function CheckInDialog({ booking: b, onClose, onDone }: Props) {
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [cleaning, setCleaning] = useState(false);

  // Hồ sơ đã có giấy tờ thì không bắt nhập lại, trừ khi lễ tân bấm "Cập nhật"
  const [editId, setEditId] = useState(!b.customer_has_id_card);
  const [idType, setIdType] = useState<IdType | "">("cccd");
  const [idCard, setIdCard] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const roomId = b.room?.id;

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    bookingApi
      .roomStatus(roomId)
      .then((s) => !cancelled && setRoomStatus(s))
      .catch(() => !cancelled && setRoomStatus("available")); // không đọc được thì để BE kiểm tra khi gửi
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const markCleaned = async () => {
    if (!roomId) return;
    setCleaning(true);
    try {
      await bookingApi.markRoomCleaned(roomId);
      setRoomStatus("available");
      toast.success(`Phòng ${b.room?.room_number} đã sẵn sàng`);
    } catch (err) {
      toast.error(errorMessage(err, "Không cập nhật được trạng thái phòng"));
    } finally {
      setCleaning(false);
    }
  };

  const card = normalizeIdCard(idCard);
  const idErr = editId ? idCardError(idType, card) : null;
  const roomOk = roomStatus === "available";
  const ready = roomOk && !idErr;

  const submit = async () => {
    setTouched(true);
    if (!ready) return;
    setBusy(true);
    try {
      const next = await bookingApi.checkIn(
        b.id,
        editId ? { id_type: idType as IdType, id_card: card } : {},
      );
      toast.success(
        `Đã nhận phòng ${b.room?.room_number ?? ""} cho ${b.customer.full_name}`,
      );
      onDone(next);
    } catch (err) {
      toast.error(errorMessage(err, "Không nhận phòng được"));
      setBusy(false);
    }
  };

  const late = b.check_in_date < todayYmd();

  return (
    <DialogShell
      title={`Nhận phòng · ${b.room?.room_number ?? ""}`}
      subtitle={bookingSubtitle(b)}
      width={540}
      busy={busy}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          {!ready && roomStatus && (
            <span className="mr-auto whitespace-nowrap text-[12px] text-room-occupied">
              Còn mục chưa đạt
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
            disabled={busy || !ready}
            className={BTN_GOLD}
          >
            {busy ? "Đang nhận phòng" : "Xác nhận nhận phòng"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5">
        <ul className="divide-y divide-dashed divide-line-soft">
          <CheckItem ok>
            {late
              ? `Khách đến trễ (đặt từ ${formatDayMonth(b.check_in_date)}), vẫn nhận phòng được tới trước ngày trả`
              : `Đúng ngày nhận phòng (${formatDayMonth(b.check_in_date)})`}
          </CheckItem>

          {roomStatus === null ? (
            <li className="flex items-center gap-2 py-2.5 text-[13px] text-ink-muted">
              <Loader2
                size={16}
                className="animate-spin"
              />{" "}
              Đang kiểm tra phòng
            </li>
          ) : roomOk ? (
            <CheckItem ok>Phòng {b.room?.room_number} đang trống và sạch</CheckItem>
          ) : (
            <CheckItem
              ok={false}
              action={
                roomStatus === "cleaning" && (
                  <button
                    type="button"
                    onClick={() => void markCleaned()}
                    disabled={cleaning}
                    className={BTN_SMALL}
                  >
                    {cleaning ? "Đang cập nhật" : "Đã dọn xong"}
                  </button>
                )
              }
            >
              Phòng {b.room?.room_number}{" "}
              <b className="font-semibold">{ROOM_PROBLEM[roomStatus]}</b>
              {(roomStatus === "maintenance" || roomStatus === "inactive") &&
                ", cần huỷ và đặt lại phòng khác"}
            </CheckItem>
          )}

          {editId ? (
            <CheckItem ok={!idErr}>
              {b.customer_has_id_card
                ? "Cập nhật giấy tờ trong hồ sơ"
                : "Hồ sơ khách chưa có số giấy tờ, nhập bên dưới"}
            </CheckItem>
          ) : (
            <CheckItem
              ok
              action={
                <button
                  type="button"
                  onClick={() => setEditId(true)}
                  className="text-[12.5px] text-navy-700 hover:underline"
                >
                  Cập nhật
                </button>
              }
            >
              Hồ sơ khách đã có số giấy tờ
            </CheckItem>
          )}
        </ul>

        {editId && (
          <div className="grid grid-cols-[180px_1fr] gap-4">
            <Field
              label="Loại giấy tờ"
              required
            >
              <Segmented
                label="Loại giấy tờ"
                value={idType}
                onChange={setIdType}
                options={(Object.keys(ID_TYPE_LABELS) as IdType[]).map((t) => ({
                  value: t,
                  label: ID_TYPE_LABELS[t],
                }))}
              />
            </Field>
            <Field
              label="Số giấy tờ"
              required
              error={touched || card.length >= 6 ? idErr : null}
              hint="Lưu luôn vào hồ sơ khách. Ảnh giấy tờ bổ sung sau ở trang Khách hàng."
            >
              <input
                value={idCard}
                onChange={(e) => setIdCard(e.target.value)}
                onBlur={() => setTouched(true)}
                autoFocus
                placeholder={idType === "passport" ? "VD: C1234567" : "12 chữ số"}
                className={`${INPUT} tabular-nums`}
              />
            </Field>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-[10px] border border-line-soft bg-cream-50 px-4 py-3">
          <div>
            <p className="text-[12px] text-ink-muted">Hoá đơn mở với tiền phòng</p>
            <p className="text-[20px] font-bold tabular-nums text-navy-900">
              {formatAmount(b.room_total)}
            </p>
          </div>
          <p className="ml-auto max-w-[200px] text-right text-[11.5px] text-ink-faint">
            Dịch vụ cộng dần, thanh toán một lần khi trả phòng
          </p>
        </div>
      </div>
    </DialogShell>
  );
}

function CheckItem({
  ok,
  action,
  children,
}: {
  ok: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5 py-2.5 text-[13px] text-ink">
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
          ok
            ? "bg-room-available/12 text-room-available"
            : "bg-room-occupied/12 text-room-occupied"
        }`}
        aria-label={ok ? "Đạt" : "Chưa đạt"}
      >
        {ok ? (
          <Check
            size={11}
            strokeWidth={3}
          />
        ) : (
          <TriangleAlert
            size={11}
            strokeWidth={2.5}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </li>
  );
}
