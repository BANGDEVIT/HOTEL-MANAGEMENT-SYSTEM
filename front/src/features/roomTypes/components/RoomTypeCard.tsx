import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  BedDouble,
  CircleCheck,
  Ellipsis,
  Maximize2,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import {
  AMENITY_LABELS,
  BED_TYPE_LABELS,
  type RoomTypeItem,
} from "../../../types/roomType";
import {
  formatAmount,
  formatMoney,
  formatMoneyShort,
  ROOM_STATUS_META,
} from "../utils/roomTypeMeta";

export type RoomTypeAction = "edit" | "toggle" | "delete";

interface Props {
  roomType: RoomTypeItem;
  canManage: boolean;
  onAction: (action: RoomTypeAction, roomType: RoomTypeItem) => void;
}

const MAX_CHIPS = 6;

/**
 * 1 thẻ = 1 loại phòng: giá, thông số, mô tả, tiện nghi, phòng theo trạng thái, số liệu 30 ngày.
 * Loại ngừng kinh doanh: nền xám, chữ nhạt.
 */
export default function RoomTypeCard({ roomType: t, canManage, onAction }: Props) {
  const off = !t.is_active;
  const shown = t.amenities.slice(0, MAX_CHIPS);
  const hidden = t.amenities.slice(MAX_CHIPS);
  const pricePerM2 = t.area ? Math.round(t.base_price / t.area) : null;

  return (
    <article
      aria-label={`Loại phòng ${t.name}`}
      className={`flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-line ${off ? "bg-cream-50" : "bg-white"}`}
    >
      {/* ===== Đầu thẻ ===== */}
      <div className="flex items-start gap-3 px-4 pb-2.5 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2">
            <span
              className={`truncate font-display text-[20px] font-bold leading-tight ${off ? "text-ink-faint" : "text-navy-900"}`}
            >
              {t.name}
            </span>
            {off && (
              <span className="whitespace-nowrap rounded-full bg-segment px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                Ngừng kinh doanh
              </span>
            )}
          </h3>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted">
            <Spec icon={Users}>{t.capacity} người</Spec>
            <Spec icon={BedDouble}>{BED_TYPE_LABELS[t.bed_type]}</Spec>
            {t.area && <Spec icon={Maximize2}>{t.area} m²</Spec>}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`whitespace-nowrap text-[17px] font-semibold tabular-nums ${off ? "text-ink-faint" : "text-ink"}`}
          >
            {formatAmount(t.base_price)}
          </p>
          <p className="text-[11px] text-ink-faint">/ đêm</p>
        </div>
        {canManage && (
          <CardMenu
            roomType={t}
            onAction={onAction}
          />
        )}
      </div>

      {/* ===== Mô tả + tiện nghi ===== */}
      <p
        className={`line-clamp-2 min-h-[38px] px-4 text-[12.5px] leading-relaxed ${t.description ? "text-ink-muted" : "italic text-ink-faint"}`}
      >
        {t.description || "Chưa có mô tả"}
      </p>
      <ul
        className="flex flex-wrap gap-1.5 px-4 pt-2.5"
        aria-label="Tiện nghi"
      >
        {shown.map((a) => (
          <li
            key={a}
            className="whitespace-nowrap rounded-full bg-segment px-2 py-0.5 text-[11px] text-ink-muted"
          >
            {AMENITY_LABELS[a]}
          </li>
        ))}
        {hidden.length > 0 && (
          <li
            title={hidden.map((a) => AMENITY_LABELS[a]).join(", ")}
            className="whitespace-nowrap rounded-full bg-segment px-2 py-0.5 text-[11px] text-ink-muted"
          >
            +{hidden.length}
          </li>
        )}
        {t.amenities.length === 0 && (
          <li className="text-[11.5px] text-ink-faint">Chưa chọn tiện nghi</li>
        )}
      </ul>

      {/* ===== Phòng theo trạng thái ===== */}
      <RoomBreakdown roomType={t} />

      {/* ===== Số liệu 30 ngày ===== */}
      <dl className="mt-auto grid grid-cols-3 border-t border-line-soft">
        <div className="px-4 py-2.5">
          <dt className="whitespace-nowrap text-[11px] text-ink-faint">
            Công suất 30 ngày
          </dt>
          <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">
            {t.occupancy_30d}%
          </dd>
          <dd
            className="mt-1 h-1 overflow-hidden rounded-full bg-segment"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-navy-700"
              style={{ width: `${t.occupancy_30d}%` }}
            />
          </dd>
        </div>
        <div
          className="border-l border-line-soft px-4 py-2.5"
          title={formatMoney(t.revenue_30d)}
        >
          <dt className="whitespace-nowrap text-[11px] text-ink-faint">
            Doanh thu phòng
          </dt>
          <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">
            {t.revenue_30d ? formatMoneyShort(t.revenue_30d) : "–"}
          </dd>
        </div>
        <div className="border-l border-line-soft px-4 py-2.5">
          <dt className="whitespace-nowrap text-[11px] text-ink-faint">Giá / m²</dt>
          <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">
            {pricePerM2 ? formatMoneyShort(pricePerM2) : "–"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/* ============================ Mảnh nhỏ ============================ */

function Spec({
  icon: Icon,
  children,
}: {
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon
        size={13}
        strokeWidth={1.8}
        aria-hidden="true"
      />{" "}
      {children}
    </span>
  );
}

/** Thanh ghép màu theo trạng thái phòng + chú thích số lượng (không để màu tự nói) */
function RoomBreakdown({ roomType: t }: { roomType: RoomTypeItem }) {
  const r = t.rooms;
  const parts = ROOM_STATUS_META.filter((m) => r[m.key] > 0);

  return (
    <div
      className={`mx-4 mt-3 rounded-[10px] border border-line-soft px-3 py-2.5 ${t.is_active ? "bg-cream-50" : "bg-white"}`}
    >
      <p className="flex justify-between gap-2 text-[12px]">
        <span>
          <b className="font-semibold tabular-nums">{r.total}</b> phòng
        </span>
        <span className="text-ink-faint">
          {t.upcoming_bookings
            ? `${t.upcoming_bookings} đặt phòng sắp tới`
            : "Chưa có đặt phòng"}
        </span>
      </p>
      {r.total > 0 ? (
        <>
          <span
            className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full"
            aria-hidden="true"
          >
            {parts.map((m) => (
              <span
                key={m.key}
                style={{
                  width: `${(r[m.key] / r.total) * 100}%`,
                  background: m.color,
                }}
              />
            ))}
          </span>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-ink-muted">
            {parts.map((m) => (
              <li
                key={m.key}
                className="inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: m.color }}
                  aria-hidden="true"
                />
                {r[m.key]} {m.label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1.5 text-[11.5px] text-ink-faint">
          Chưa gắn phòng nào. Thêm phòng ở trang Phòng.
        </p>
      )}
    </div>
  );
}

/* ============================ Menu ⋯ ============================ */

const MENU_WIDTH = 240;

/**
 * Menu render qua PORTAL vào body (giống menu ở trang Dịch vụ): nằm trong thẻ thì bị overflow cắt.
 * Cuộn / đổi kích thước cửa sổ thì đóng (vị trí cũ đã sai).
 */
function CardMenu({
  roomType: t,
  onAction,
}: {
  roomType: RoomTypeItem;
  onAction: Props["onAction"];
}) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) =>
      !menuRef.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  const run = (action: RoomTypeAction) => () => {
    setPos(null);
    onAction(action, t);
  };

  const item =
    "flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[13px] hover:bg-cream-50";

  return (
    <>
      <button
        type="button"
        aria-label={`Thao tác với ${t.name}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={(e) => {
          if (pos) return setPos(null);
          const r = e.currentTarget.getBoundingClientRect();
          const up = r.bottom + 170 > window.innerHeight; // sát đáy màn hình thì mở lên trên
          setPos({
            top: up ? r.top - 6 : r.bottom + 6,
            left: Math.max(8, r.right - MENU_WIDTH),
            up,
          });
        }}
        className="-mr-1.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-ink-faint hover:bg-segment hover:text-ink"
      >
        <Ellipsis size={16} />
      </button>

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              transform: pos.up ? "translateY(-100%)" : undefined,
            }}
            className="fixed z-50 rounded-[12px] border border-line bg-white p-1.5 shadow-[0_12px_30px_rgba(20,38,59,.18)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={run("edit")}
              className={`${item} text-ink`}
            >
              <Pencil
                size={14}
                className="text-ink-muted"
              />{" "}
              Sửa
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={run("toggle")}
              className={`${item} text-ink`}
            >
              {t.is_active ? (
                <>
                  <Ban
                    size={14}
                    className="text-ink-muted"
                  />{" "}
                  Ngừng kinh doanh
                </>
              ) : (
                <>
                  <CircleCheck
                    size={14}
                    className="text-ink-muted"
                  />{" "}
                  Mở bán lại
                </>
              )}
            </button>
            <div className="my-1 border-t border-line-soft" />
            <button
              type="button"
              role="menuitem"
              disabled={!t.can_delete}
              onClick={run("delete")}
              className={`${item} ${t.can_delete ? "text-room-occupied" : "cursor-not-allowed text-ink-faint hover:bg-transparent"}`}
            >
              <Trash2 size={14} /> Xoá
            </button>
            {!t.can_delete && (
              <p className="px-3 pb-1.5 pl-[34px] text-[11px] leading-snug text-ink-faint">
                Đang có {t.rooms.total} phòng, chỉ ngừng kinh doanh được
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
