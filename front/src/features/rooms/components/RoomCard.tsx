import { BedDouble, ImageIcon, ImageOff, Users } from "lucide-react";
import type { Room } from "../../../types/room";
import { BED_TYPE_LABELS, STATUS_COLOR, STATUS_LABELS } from "../../../types/room";
import RoomActionsMenu from "./RoomActionsMenu";

interface Props {
  room: Room;
  onEdit: (room: Room) => void;
  onManageImages: (room: Room) => void;
}

const price = new Intl.NumberFormat("vi-VN");

/**
 * Một thẻ phòng trong dạng lưới.
 *
 * Cả thẻ KHÔNG phải 1 nút lớn, mà gồm 3 vùng bấm riêng:
 *   ảnh -> quản lý ảnh, phần thân -> sửa thông tin, "⋯" -> menu.
 * Lý do: nút lồng trong nút là HTML sai, trình đọc màn hình và bàn phím sẽ lỗi.
 */
export default function RoomCard({ room, onEdit, onManageImages }: Props) {
  const cover = room.images?.[0];
  const imageCount = room.images?.length ?? 0;
  const color = STATUS_COLOR[room.status];

  return (
    <article className="relative flex flex-col overflow-hidden rounded-[14px] border border-line bg-white transition-colors hover:border-line-input">
      {/* ===== Vùng ảnh ===== */}
      <button
        type="button"
        onClick={() => onManageImages(room)}
        aria-label={`Quản lý ảnh phòng ${room.room_number}`}
        className="relative h-32 w-full bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-700"
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-[11.5px] text-ink-faint">
            <ImageOff
              size={18}
              strokeWidth={1.6}
            />
            Chưa có ảnh
          </span>
        )}
        {imageCount > 1 && (
          <span className="absolute bottom-2 right-2 flex h-5 items-center gap-1 rounded-[5px] bg-navy-900/70 px-1.5 text-[10.5px] tabular-nums text-white">
            <ImageIcon
              size={11}
              strokeWidth={2}
            />
            {imageCount}
          </span>
        )}
      </button>

      {/* Nhãn trạng thái nằm đè lên ảnh. pointer-events-none: bấm xuyên qua xuống ảnh */}
      <span
        className="pointer-events-none absolute left-2.5 top-2.5 inline-flex h-[22px] items-center gap-1.5 rounded-full bg-white px-2 text-[11px] font-semibold shadow-[0_1px_2px_rgba(20,38,59,.15)]"
        style={{ color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        {STATUS_LABELS[room.status]}
      </span>

      <div className="absolute right-2 top-2">
        <RoomActionsMenu
          room={room}
          variant="card"
          onEdit={onEdit}
          onManageImages={onManageImages}
        />
      </div>

      {/* ===== Phần thân ===== */}
      <button
        type="button"
        onClick={() => onEdit(room)}
        className="flex flex-1 flex-col px-3.5 pb-3 pt-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-700"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-[16px] font-bold tabular-nums text-navy-900">
            {room.room_number}
          </span>
          <span className="truncate rounded-[6px] bg-gold-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-gold-700">
            {room.room_type.name}
          </span>
        </span>
        <span className="text-[11.5px] text-ink-muted">Tầng {room.floor}</span>

        <span className="mt-2 flex gap-3 text-[11.5px] text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <BedDouble
              size={13}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            {BED_TYPE_LABELS[room.room_type.bed_type]}
          </span>
          <span className="flex items-center gap-1.5">
            <Users
              size={13}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            {room.room_type.capacity} khách
          </span>
        </span>

        <span className="mt-2.5 flex items-baseline justify-between border-t border-line-soft pt-2">
          <span className="text-[11px] text-ink-faint">Giá / đêm</span>
          <span className="text-[14px] font-bold tabular-nums text-navy-900">
            {price.format(Number(room.room_type.base_price))}
            <span className="ml-px text-[11px] font-medium text-ink-muted">đ</span>
          </span>
        </span>
      </button>
    </article>
  );
}
