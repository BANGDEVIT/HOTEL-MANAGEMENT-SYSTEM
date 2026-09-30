import { useState } from "react";
import { toast } from "sonner";
import { serviceApi } from "../../../api/serviceApi";
import { errorMessage } from "../../../utils/errorMessage";
import type { ServiceItem } from "../../../types/service";
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
} from "../../booking/components/styles";
import { DialogShell } from "../../booking/components/ui";

interface Props {
  service: ServiceItem;
  onClose: () => void;
  /** removed = xoá hẳn; deactivated = chuyển sang ngừng bán thay vì xoá */
  onDone: (result: "removed" | "deactivated", service: ServiceItem) => void;
}

/**
 * 2 trường hợp:
 *   - Chưa từng dùng (tạo nhầm): hỏi lại rồi xoá hẳn.
 *   - Đã có trong hoá đơn: KHÔNG cho xoá (mất lịch sử hoá đơn), giải thích và gợi ý ngừng bán.
 * BE cũng chặn (409) nên dù FE sai vẫn không mất dữ liệu.
 */
export default function DeleteServiceDialog({ service: s, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await serviceApi.remove(s.id);
      toast.success(`Đã xoá dịch vụ "${s.name}"`);
      onDone("removed", s);
    } catch (err) {
      toast.error(errorMessage(err, "Không xoá được dịch vụ"));
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      const updated = await serviceApi.setActive(s.id, false);
      toast.success(`Đã ngừng bán "${s.name}"`);
      onDone("deactivated", updated);
    } catch (err) {
      toast.error(errorMessage(err, "Không đổi được trạng thái"));
      setBusy(false);
    }
  };

  if (s.can_delete) {
    return (
      <DialogShell
        title="Xoá dịch vụ"
        subtitle={s.name}
        width={440}
        busy={busy}
        onClose={onClose}
        onSubmit={() => void remove()}
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
              {busy ? "Đang xoá" : "Xoá hẳn"}
            </button>
          </>
        }
      >
        <p className="px-6 py-5 text-[13.5px] leading-relaxed text-ink">
          Dịch vụ này chưa từng được dùng nên có thể xoá hẳn. Thao tác không hoàn tác
          được.
        </p>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title="Không thể xoá dịch vụ"
      subtitle={s.name}
      width={460}
      busy={busy}
      onClose={onClose}
      onSubmit={() => (s.is_active ? void deactivate() : onClose())}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={BTN_SECONDARY}
          >
            Đóng
          </button>
          {s.is_active && (
            <button
              type="submit"
              disabled={busy}
              className={BTN_PRIMARY}
            >
              {busy ? "Đang xử lý" : "Ngừng bán thay vì xoá"}
            </button>
          )}
        </>
      }
    >
      <div className="grid gap-3 px-6 py-5">
        <p className="rounded-[10px] border border-room-occupied/25 bg-[#F8E4DF] px-4 py-3 text-[13px] leading-relaxed text-[#7A2A1C]">
          Dịch vụ này đã có trong{" "}
          <b className="font-semibold">{s.total_uses} lần dùng</b> ở các hoá đơn. Xoá
          sẽ làm mất lịch sử hoá đơn, nên chỉ có thể{" "}
          <b className="font-semibold">ngừng bán</b>: lễ tân không chọn được nữa, hoá
          đơn cũ vẫn giữ nguyên.
        </p>
        {!s.is_active && (
          <p className="text-[12.5px] text-ink-muted">
            Dịch vụ đã ở trạng thái ngừng bán.
          </p>
        )}
      </div>
    </DialogShell>
  );
}
