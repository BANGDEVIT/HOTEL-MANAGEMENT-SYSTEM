import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Room, RoomStatus } from "../../../types/room";
import { STATUS_COLOR, STATUS_LABELS, VALID_TRANSITIONS } from "../../../types/room";
import { useRoomStore } from "../stores/room.store";

/**
 * Menu "⋯" của một phòng. Tách ra từ RoomRow để THẺ phòng (dạng lưới)
 * và DÒNG phòng (dạng danh sách) dùng chung đúng một menu.
 * Sau này thêm thao tác mới thì chỉ sửa ở đây.
 */

const MENU_WIDTH = 204;

interface Props {
  room: Room;
  onEdit: (room: Room) => void;
  onManageImages: (room: Room) => void;
  /** card: nút tròn nền trắng nổi trên ảnh. row: nút phẳng trong dòng bảng */
  variant?: "card" | "row";
}

const TRIGGER = {
  card: "w-7 h-7 rounded-full bg-white/95 text-ink shadow-[0_1px_2px_rgba(20,38,59,.18)] hover:bg-white",
  row: "w-7 h-7 rounded-md text-ink-muted hover:bg-segment hover:text-ink",
};

export default function RoomActionsMenu({
  room,
  onEdit,
  onManageImages,
  variant = "card",
}: Props) {
  const updateRoomStatus = useRoomStore((s) => s.updateRoomStatus);
  const deleteRoom = useRoomStore((s) => s.deleteRoom);

  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const nextStatuses = VALID_TRANSITIONS[room.status];
  const canHide = room.status !== "occupied" && room.status !== "inactive";

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  // Đo vị trí TRƯỚC khi trình duyệt vẽ: không có khoảnh khắc menu nháy ở chỗ sai.
  // Sát đáy màn hình thì lật lên trên nút.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }
    const btn = btnRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 240;
    const openUp = window.innerHeight - btn.bottom < menuHeight + 12;
    setPos({
      top: openUp ? btn.top - menuHeight - 4 : btn.bottom + 4,
      left: Math.min(
        window.innerWidth - MENU_WIDTH - 8,
        Math.max(8, btn.right - MENU_WIDTH),
      ),
    });
  }, [open, confirming]);

  // Bấm ra ngoài (không phải nút, không phải menu) thì đóng
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Menu đặt ở vị trí cố định theo màn hình -> cuộn trang hay đổi kích thước thì đóng
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const changeStatus = async (status: RoomStatus) => {
    setBusy(true);
    try {
      await updateRoomStatus(room.id, { status });
      toast.success(
        `Phòng ${room.room_number} chuyển sang ${STATUS_LABELS[status].toLowerCase()}`,
      );
      close();
    } catch {
      // store đã báo lỗi
    } finally {
      setBusy(false);
    }
  };

  const hide = async () => {
    setBusy(true);
    try {
      await deleteRoom(room.id);
      toast.success(`Đã ẩn phòng ${room.room_number}`);
      close();
    } catch {
      // store đã báo lỗi
    } finally {
      setBusy(false);
    }
  };

  const item =
    "w-full flex items-center gap-2.5 px-3 h-9 text-[12.5px] text-ink hover:bg-row-hover disabled:opacity-50";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Thao tác với phòng ${room.room_number}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex items-center justify-center transition-colors ${TRIGGER[variant]}`}
      >
        <MoreHorizontal
          size={15}
          strokeWidth={1.8}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: MENU_WIDTH,
              visibility: pos ? "visible" : "hidden", // chưa đo xong thì ẩn
            }}
            className="z-50 overflow-hidden rounded-[12px] border border-line bg-white py-1 shadow-[0_8px_24px_rgba(20,38,59,.14)]"
          >
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                onEdit(room);
                close();
              }}
            >
              <Pencil
                size={14}
                strokeWidth={1.8}
                className="text-ink-muted"
              />
              Sửa thông tin
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                onManageImages(room);
                close();
              }}
            >
              <ImageIcon
                size={14}
                strokeWidth={1.8}
                className="text-ink-muted"
              />
              Quản lý ảnh
            </button>

            {nextStatuses.length > 0 && (
              <div className="mt-1 border-t border-line-soft pt-1">
                <p className="px-3 pb-1 pt-1.5 text-[11px] text-ink-faint">
                  Chuyển trạng thái
                </p>
                {nextStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className={item}
                    onClick={() => changeStatus(status)}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: STATUS_COLOR[status] }}
                    />
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            )}

            {canHide && (
              <div className="mt-1 border-t border-line-soft pt-1">
                {confirming ? (
                  <div className="p-2.5">
                    <p className="mb-2 text-[11.5px] leading-snug text-ink-secondary">
                      Ẩn phòng {room.room_number} khỏi danh sách đang kinh doanh?
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={hide}
                        className="h-8 flex-1 rounded-[8px] bg-destructive text-[12px] font-medium text-white disabled:opacity-60"
                      >
                        Ẩn phòng
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="h-8 flex-1 rounded-[8px] border border-line-input text-[12px] text-ink-secondary"
                      >
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setConfirming(true)}
                    className="flex h-9 w-full items-center gap-2.5 px-3 text-[12.5px] text-destructive hover:bg-[#F8E4DF]"
                  >
                    <Trash2
                      size={14}
                      strokeWidth={1.8}
                    />
                    Ẩn phòng
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
