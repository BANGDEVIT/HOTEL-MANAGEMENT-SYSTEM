import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { RoomType } from "../../../types/roomType";
import { BED_TYPE_LABELS } from "../../../types/room";
import { useRoomTypeStore } from "../store/roomTypeStore";
import AmenityChips from "./AmenityChips";
import OccupancyBar from "./OccupancyBar";

export const ROOM_TYPE_GRID = "minmax(0,1fr) 124px 256px 104px 36px";
const MENU_WIDTH = 196;

interface Props {
  roomType: RoomType;
  onEdit: (rt: RoomType) => void;
}

export default function RoomTypeRow({ roomType, onEdit }: Props) {
  const { deleteRoomType, roomStats } = useRoomTypeStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hidden = roomType.is_active === false;
  const stats = roomStats[roomType.id];

  useLayoutEffect(() => {
    if (!menuOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const btn = btnRef.current.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? 140;
    const up = window.innerHeight - btn.bottom < h + 12;
    setPos({
      top: up ? btn.top - h - 4 : btn.bottom + 4,
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
    const close = () => {
      setMenuOpen(false);
      setConfirming(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const handleHide = async () => {
    setBusy(true);
    try {
      await deleteRoomType(roomType.id);
      toast.success(`Đã ẩn loại phòng ${roomType.name}`);
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
      className={`grid items-center gap-3.5 min-h-[68px] px-4 border-b border-[#F0F1F3] last:border-b-0 hover:bg-[#F5F6F7] transition-colors
        ${hidden ? "opacity-60" : ""}`}
      style={{ gridTemplateColumns: ROOM_TYPE_GRID }}
    >
      {/* 1. Tên + giường, sức chứa */}
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-[#14181D] truncate">
          {roomType.name}
        </p>
        <p className="text-[12px] text-[#5C6672] mt-0.5">
          {BED_TYPE_LABELS[roomType.bed_type]}, {roomType.capacity} khách
        </p>
      </div>

      {/* 2. Tình trạng phòng thuộc loại này */}
      <OccupancyBar stats={stats} />

      {/* 3. Tiện nghi */}
      <AmenityChips amenities={roomType.amenities} />

      {/* 4. Giá */}
      <div className="text-right">
        <p className="text-[16px] font-medium text-[#14181D] tabular-nums">
          {roomType.base_price.toLocaleString("vi-VN")}
        </p>
        <p className="text-[11px] text-[#98A1AC]">đồng</p>
      </div>

      {/* 5. Menu */}
      <div className="justify-self-center">
        <button
          ref={btnRef}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={`Thao tác với ${roomType.name}`}
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
              className="z-50 bg-white border border-[#E4E6E9] rounded-lg overflow-hidden shadow-[0_4px_12px_rgba(20,24,29,.10)]"
            >
              <button
                onClick={() => {
                  onEdit(roomType);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#14181D] hover:bg-[#F5F6F7]"
              >
                <Pencil
                  size={13}
                  strokeWidth={1.75}
                  className="text-[#98A1AC]"
                />
                Sửa loại phòng
              </button>

              {!hidden && (
                <div className="border-t border-[#F0F1F3]">
                  {confirming ? (
                    <div className="p-2.5">
                      <p className="text-[11px] text-[#5C6672] mb-2 leading-snug">
                        {stats?.total
                          ? `Loại này đang có ${stats.total} phòng. BE sẽ không cho ẩn khi còn phòng.`
                          : `Ẩn ${roomType.name} khỏi danh sách đang bán?`}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          disabled={busy}
                          onClick={handleHide}
                          className="flex-1 h-7 rounded-md bg-[#B4321F] text-white text-[11px] font-medium disabled:opacity-60"
                        >
                          Ẩn
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
                      <EyeOff
                        size={13}
                        strokeWidth={1.75}
                      />
                      Ẩn loại phòng
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
