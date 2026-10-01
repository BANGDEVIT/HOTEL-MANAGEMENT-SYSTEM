import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CircleCheck, Trash2 } from "lucide-react";
import { roomTypeApi } from "../../../api/roomTypeApi";
import { errorMessage } from "../../../utils/errorMessage";
import type { RoomTypeItem } from "../../../types/roomType";
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
} from "../../booking/components/styles";
import { DialogShell } from "../../booking/components/ui";

/* ============================ Ngừng kinh doanh / Mở bán lại ============================ */

/**
 * Ngừng: không nhận đặt phòng MỚI (khách online và lễ tân tại quầy), đặt phòng đã có giữ nguyên.
 * Mở bán lại: xác nhận nhẹ, không cảnh báo.
 */
export function ToggleRoomTypeDialog({
  roomType: t,
  onClose,
  onDone,
}: {
  roomType: RoomTypeItem;
  onClose: () => void;
  onDone: (next: RoomTypeItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const stopping = t.is_active;

  const submit = async () => {
    setBusy(true);
    try {
      const next = await roomTypeApi.setActive(t.id, !t.is_active);
      toast.success(
        next.is_active
          ? `Đã mở bán lại "${t.name}"`
          : `Đã ngừng kinh doanh "${t.name}"`,
      );
      onDone(next);
    } catch (err) {
      toast.error(errorMessage(err, "Không đổi được trạng thái"));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={stopping ? `Ngừng kinh doanh ${t.name}?` : `Mở bán lại ${t.name}?`}
      subtitle={`${t.rooms.total} phòng · ${t.upcoming_bookings} đặt phòng sắp tới`}
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
            Giữ nguyên
          </button>
          <button
            type="submit"
            disabled={busy}
            autoFocus
            className={BTN_PRIMARY}
          >
            {busy ? "Đang lưu" : stopping ? "Ngừng kinh doanh" : "Mở bán lại"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 px-6 py-5 text-[12.5px] leading-relaxed">
        {stopping ? (
          <>
            <p className="flex items-start gap-2.5 rounded-[12px] border border-[#EBD9A6] bg-[#FBF5E4] px-3.5 py-3 text-[#6E5616]">
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                <b className="font-semibold">
                  Không nhận đặt phòng mới cho loại này
                </b>
                , kể cả khách tự đặt online và lễ tân tạo tại quầy.
                {t.upcoming_bookings > 0 &&
                  ` ${t.upcoming_bookings} đặt phòng đã có vẫn giữ nguyên, khách vẫn nhận phòng bình thường.`}
              </span>
            </p>
            <p className="flex items-start gap-2.5 rounded-[12px] border border-[#CFE6DA] bg-[#EEF7F2] px-3.5 py-3 text-[#0F5139]">
              <CircleCheck
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Lịch sử đặt phòng, hoá đơn giữ nguyên. Mở bán lại bất cứ lúc nào.
            </p>
          </>
        ) : (
          <p className="text-ink-secondary">
            Khách và lễ tân lại đặt được loại phòng này với giá hiện tại. Nhớ kiểm
            tra giá trước khi mở bán.
          </p>
        )}
      </div>
    </DialogShell>
  );
}

/* ============================ Xoá hẳn ============================ */

/** Chỉ mở được khi can_delete (chưa có phòng). BE vẫn kiểm tra lại, có phòng -> 409 */
export function DeleteRoomTypeDialog({
  roomType: t,
  onClose,
  onDone,
}: {
  roomType: RoomTypeItem;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await roomTypeApi.remove(t.id);
      toast.success(`Đã xoá loại phòng "${t.name}"`);
      onDone(t.id);
    } catch (err) {
      toast.error(errorMessage(err, "Không xoá được loại phòng"));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={`Xoá loại phòng ${t.name}?`}
      subtitle="Chưa có phòng nào thuộc loại này"
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
            autoFocus
            className={BTN_SECONDARY}
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={busy}
            className={BTN_DANGER}
          >
            {busy ? "Đang xoá" : `Xoá ${t.name}`}
          </button>
        </>
      }
    >
      <div className="px-6 py-5">
        <p className="flex items-start gap-2.5 rounded-[12px] border border-[#EBC7BE] bg-[#FBF0ED] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#7A2616]">
          <Trash2
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            <b className="font-semibold">Xoá hẳn, không khôi phục được.</b> Chỉ xoá
            được khi loại phòng chưa gắn với phòng nào (thường là tạo nhầm). Loại đã
            có phòng thì dùng "Ngừng kinh doanh".
          </span>
        </p>
      </div>
    </DialogShell>
  );
}
