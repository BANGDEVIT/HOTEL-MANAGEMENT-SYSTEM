import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, ImageOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Room, RoomStatus } from "../../../types/room";
import {
  BED_TYPE_LABELS,
  STATUS_COLOR,
  STATUS_LABELS,
  VALID_TRANSITIONS,
} from "../../../types/room";
import { useRoomStore } from "../stores/room.store";

interface Props {
  room: Room;
  onEdit: (room: Room) => void;
  onManageImages: (room: Room) => void;
}

const MENU_WIDTH = 196;

// 9 cột, khớp đúng 9 ô con bên dưới:
// thanh màu | ảnh | số phòng | loại | giường | sức chứa | giá | trạng thái | menu
const GRID = "3px 62px 64px 1fr 104px 74px 96px 88px 36px";

export default function RoomRow({ room, onEdit, onManageImages }: Props) {
  const { updateRoomStatus, deleteRoom } = useRoomStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const nextStatuses = VALID_TRANSITIONS[room.status];
  const canDelete = room.status !== "occupied" && room.status !== "inactive";
  const cover = room.images?.[0];
  const imageCount = room.images?.length ?? 0;

  useLayoutEffect(() => {
    if (!menuOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const btn = btnRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 240;
    const openUpward = window.innerHeight - btn.bottom < menuHeight + 12;

    setPos({
      top: openUpward ? btn.top - menuHeight - 4 : btn.bottom + 4,
      left: Math.max(8, btn.right - MENU_WIDTH),
    });
  }, [menuOpen, confirming]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
      setConfirming(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => {
      setMenuOpen(false);
      setConfirming(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const changeStatus = async (status: RoomStatus) => {
    setBusy(true);
    try {
      await updateRoomStatus(room.id, { status });
      toast.success(
        `Phòng ${room.room_number} chuyển sang ${STATUS_LABELS[status].toLowerCase()}`,
      );
      setMenuOpen(false);
    } catch {
      // store đã báo lỗi
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteRoom(room.id);
      toast.success(`Đã ẩn phòng ${room.room_number}`);
      setMenuOpen(false);
    } catch {
      // store đã báo lỗi
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className="grid items-center h-[52px] border-b border-[#F0F1F3] pr-2 hover:bg-[#F5F6F7] transition-colors"
      style={{ gridTemplateColumns: GRID }}
    >
      {/* 1. Thanh trạng thái */}
      <div
        className="h-full"
        style={{ background: STATUS_COLOR[room.status] }}
      />

      {/* 2. Ảnh bìa */}
      <div className="pl-3.5">
        <button
          onClick={() => onManageImages(room)}
          title={imageCount ? `${imageCount} ảnh` : "Chưa có ảnh"}
          className="relative w-12 h-9 rounded-md overflow-hidden bg-[#F5F6F7] border border-[#E4E6E9] flex items-center justify-center hover:border-[#CDD2D8]"
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageOff
              size={14}
              strokeWidth={1.75}
              className="text-[#CDD2D8]"
            />
          )}
          {imageCount > 1 && (
            <span className="absolute bottom-0.5 right-0.5 px-1 rounded-sm bg-[#14181D]/70 text-white text-[9px] leading-[13px] tabular-nums">
              {imageCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Số phòng */}
      <div className="text-[15px] font-semibold text-[#14181D] tabular-nums">
        {room.room_number}
      </div>

      {/* 4. Loại phòng */}
      <div className="text-[13px] text-[#14181D] truncate">
        {room.room_type.name}
      </div>

      {/* 5. Giường */}
      <div className="text-[12px] text-[#5C6672] whitespace-nowrap">
        {BED_TYPE_LABELS[room.room_type.bed_type]}
      </div>

      {/* 6. Sức chứa */}
      <div className="text-[12px] text-[#98A1AC] tabular-nums whitespace-nowrap">
        {room.room_type.capacity} khách
      </div>

      {/* 7. Giá */}
      <div className="text-[13px] text-[#14181D] text-right tabular-nums">
        {room.room_type.base_price.toLocaleString("vi-VN")}
      </div>

      {/* 8. Trạng thái */}
      <div
        className="text-[12px] text-right whitespace-nowrap"
        style={{ color: STATUS_COLOR[room.status] }}
      >
        {STATUS_LABELS[room.status]}
      </div>

      {/* 9. Menu */}
      <div className="justify-self-center">
        <button
          ref={btnRef}
          onClick={() => setMenuOpen((o) => !o)}
          className="w-7 h-7 flex items-center justify-center rounded text-[#98A1AC] hover:bg-[#E4E6E9] hover:text-[#14181D]"
        >
          <MoreHorizontal
            size={15}
            strokeWidth={1.75}
          />
        </button>

        {menuOpen &&
          createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                width: MENU_WIDTH,
                visibility: pos ? "visible" : "hidden",
              }}
              className="bg-white border border-[#E4E6E9] rounded-lg shadow-[0_4px_12px_rgba(20,24,29,.10)] z-50 overflow-hidden"
            >
              <button
                onClick={() => {
                  onEdit(room);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#14181D] hover:bg-[#F5F6F7]"
              >
                <Pencil
                  size={13}
                  strokeWidth={1.75}
                  className="text-[#98A1AC]"
                />
                Sửa thông tin
              </button>

              <button
                onClick={() => {
                  onManageImages(room);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#14181D] hover:bg-[#F5F6F7]"
              >
                <ImageIcon
                  size={13}
                  strokeWidth={1.75}
                  className="text-[#98A1AC]"
                />
                Quản lý ảnh
              </button>

              {nextStatuses.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] text-[#98A1AC] border-t border-[#F0F1F3]">
                    Chuyển trạng thái
                  </div>
                  {nextStatuses.map((status) => (
                    <button
                      key={status}
                      disabled={busy}
                      onClick={() => changeStatus(status)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#14181D] hover:bg-[#F5F6F7] disabled:opacity-50"
                    >
                      <span
                        className="w-[7px] h-[7px] rounded-full"
                        style={{ background: STATUS_COLOR[status] }}
                      />
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </>
              )}

              {canDelete && (
                <div className="border-t border-[#F0F1F3]">
                  {confirming ? (
                    <div className="p-2.5">
                      <p className="text-[11px] text-[#5C6672] mb-2 leading-snug">
                        Ẩn phòng {room.room_number} khỏi danh sách?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          disabled={busy}
                          onClick={handleDelete}
                          className="flex-1 h-7 rounded-md bg-[#B4321F] text-white text-[11px] font-medium disabled:opacity-60"
                        >
                          Ẩn phòng
                        </button>
                        <button
                          onClick={() => setConfirming(false)}
                          className="flex-1 h-7 rounded-md border border-[#E4E6E9] text-[11px] text-[#5C6672]"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#B4321F] hover:bg-[#FEF2F2]"
                    >
                      <Trash2
                        size={13}
                        strokeWidth={1.75}
                      />
                      Ẩn phòng
                    </button>
                  )}
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
