import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Ban, CircleCheck, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { serviceApi } from "../../../api/serviceApi";
import { errorMessage } from "../../../utils/errorMessage";
import { useServiceStore } from "../store/serviceStore";
import {
  CATEGORY_LABELS,
  UNIT_LABELS,
  type ServiceItem,
} from "../../../types/service";
import { CATEGORY_META, formatAmount, formatQty } from "../utils/serviceMeta";

interface Props {
  canManage: boolean;
  onEdit: (service: ServiceItem) => void;
  onDelete: (service: ServiceItem) => void;
}

/** Header và dòng dùng CHUNG 1 hằng số cột */
const COLS =
  "grid-cols-[minmax(240px,2.2fr)_120px_minmax(160px,1.3fr)_150px_132px_32px]";

export default function ServiceTable({ canManage, onEdit, onDelete }: Props) {
  const services = useServiceStore((s) => s.services);
  const loading = useServiceStore((s) => s.loading);
  const lastUpdated = useServiceStore((s) => s.lastUpdated);

  if (loading && !lastUpdated) {
    return (
      <p className="py-16 text-center text-[13px] text-ink-muted">
        Đang tải danh sách dịch vụ
      </p>
    );
  }

  if (services.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[14px] font-medium text-ink">Không có dịch vụ phù hợp</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Thử từ khoá khác hoặc bỏ bớt bộ lọc.
        </p>
      </div>
    );
  }

  // Thanh lượt dùng so với dịch vụ dùng nhiều nhất TRÊN TRANG NÀY
  const maxUsage = Math.max(1, ...services.map((s) => s.usage_30d));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div
          aria-hidden="true"
          className={`grid ${COLS} h-10 items-center gap-4 whitespace-nowrap border-b border-line px-[18px] text-[11px] font-semibold uppercase tracking-[.06em] text-ink-faint`}
        >
          <span>Dịch vụ</span>
          <span className="text-right">Đơn giá</span>
          <span>Lượt dùng 30 ngày</span>
          <span className="text-right">Doanh thu 30 ngày</span>
          <span>Đang bán</span>
          <span />
        </div>

        {services.map((s) => (
          <Row
            key={s.id}
            service={s}
            maxUsage={maxUsage}
            canManage={canManage}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  service: s,
  maxUsage,
  canManage,
  onEdit,
  onDelete,
}: {
  service: ServiceItem;
  maxUsage: number;
  canManage: boolean;
  onEdit: (s: ServiceItem) => void;
  onDelete: (s: ServiceItem) => void;
}) {
  const { icon: Icon, color } = CATEGORY_META[s.category];
  const off = !s.is_active;

  return (
    <div
      className={`grid ${COLS} min-h-[62px] items-center gap-4 border-b border-line-soft px-[18px] py-2.5 hover:bg-row-hover`}
    >
      {/* Dịch vụ */}
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
          style={{ color, background: `color-mix(in srgb, ${color} 11%, white)` }}
          aria-hidden="true"
        >
          <Icon
            size={16}
            strokeWidth={1.8}
          />
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-[13.5px] font-semibold ${off ? "text-ink-faint" : "text-ink"}`}
          >
            {s.name}
          </span>
          <span
            className="mt-0.5 inline-block rounded-[4px] px-1.5 text-[10.5px] font-medium"
            style={{ color, background: `color-mix(in srgb, ${color} 11%, white)` }}
          >
            {CATEGORY_LABELS[s.category]}
          </span>
        </span>
      </span>

      {/* Đơn giá */}
      <span className="text-right">
        <span
          className={`block text-[13.5px] font-semibold tabular-nums ${off ? "text-ink-faint" : "text-ink"}`}
        >
          {formatAmount(s.price)}
        </span>
        <span className="block text-[11.5px] text-ink-muted">
          / {UNIT_LABELS[s.unit]}
        </span>
      </span>

      {/* Lượt dùng */}
      <span className="min-w-0">
        <span
          className={`block text-[12.5px] tabular-nums ${s.usage_30d ? "text-ink" : "text-ink-faint"}`}
        >
          {s.usage_30d ? formatQty(s.usage_30d, s.unit) : "Chưa ai dùng"}
        </span>
        <span
          className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-segment"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-gold-500"
            style={{ width: `${(s.usage_30d / maxUsage) * 100}%` }}
          />
        </span>
      </span>

      {/* Doanh thu */}
      <span
        className={`text-right text-[13px] tabular-nums ${s.revenue_30d ? "font-semibold text-ink" : "text-ink-faint"}`}
      >
        {formatAmount(s.revenue_30d)}
      </span>

      {/* Đang bán */}
      <ActiveToggle
        service={s}
        disabled={!canManage}
      />

      {/* Menu */}
      {canManage ? (
        <RowMenu
          service={s}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <span />
      )}
    </div>
  );
}

/* ============================ Nút gạt Đang bán ============================ */

function ActiveToggle({
  service: s,
  disabled,
}: {
  service: ServiceItem;
  disabled: boolean;
}) {
  const replaceItem = useServiceStore((st) => st.replaceItem);
  const fetchStats = useServiceStore((st) => st.fetchStats);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await serviceApi.setActive(s.id, !s.is_active);
      replaceItem(updated); // chỉ thay dòng này, không tải lại cả bảng
      void fetchStats();
      toast.success(
        updated.is_active ? `Đã mở bán lại "${s.name}"` : `Đã ngừng bán "${s.name}"`,
      );
    } catch (err) {
      toast.error(errorMessage(err, "Không đổi được trạng thái"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={s.is_active}
        aria-label={`${s.is_active ? "Ngừng bán" : "Mở bán"} ${s.name}`}
        disabled={disabled || busy}
        onClick={() => void toggle()}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
          s.is_active ? "bg-room-available" : "bg-line-input"
        } ${disabled ? "opacity-50" : ""} ${busy ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] ${
            s.is_active ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
      <span className="whitespace-nowrap text-[12px] text-ink-muted">
        {s.is_active ? "Đang bán" : "Ngừng bán"}
      </span>
    </span>
  );
}

/* ============================ Menu ⋯ ============================ */

const MENU_WIDTH = 230;

/**
 * Menu render qua PORTAL vào body (DESIGN.md 5.5): nếu nằm trong bảng thì bị khung
 * overflow-x-auto cắt mất. Vị trí tính từ nút ⋯ ngay lúc bấm; sát đáy màn hình thì lật lên trên.
 * Cuộn trang / đổi kích thước cửa sổ thì đóng (vị trí cũ đã sai).
 */
function RowMenu({
  service: s,
  onEdit,
  onDelete,
}: {
  service: ServiceItem;
  onEdit: (s: ServiceItem) => void;
  onDelete: (s: ServiceItem) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const replaceItem = useServiceStore((st) => st.replaceItem);
  const fetchStats = useServiceStore((st) => st.fetchStats);

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const up = r.bottom + 190 > window.innerHeight;
    setPos({
      top: up ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, r.right - MENU_WIDTH),
      up,
    });
  };

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
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

  const run = (fn: () => void) => () => {
    setPos(null);
    fn();
  };

  const toggleActive = async () => {
    try {
      const updated = await serviceApi.setActive(s.id, !s.is_active);
      replaceItem(updated);
      void fetchStats();
      toast.success(
        updated.is_active ? `Đã mở bán lại "${s.name}"` : `Đã ngừng bán "${s.name}"`,
      );
    } catch (err) {
      toast.error(errorMessage(err, "Không đổi được trạng thái"));
    }
  };

  const item =
    "flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[13px] text-ink hover:bg-cream-50";

  return (
    <>
      <button
        type="button"
        aria-label={`Thao tác với ${s.name}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={(e) => (pos ? setPos(null) : open(e))}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-faint hover:bg-segment hover:text-ink"
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
              onClick={run(() => onEdit(s))}
              className={item}
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
              onClick={run(() => void toggleActive())}
              className={item}
            >
              {s.is_active ? (
                <>
                  <Ban
                    size={14}
                    className="text-ink-muted"
                  />{" "}
                  Ngừng bán
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
              onClick={run(() => onDelete(s))}
              className={`${item} ${s.can_delete ? "text-room-occupied" : "text-ink-faint"}`}
            >
              <Trash2 size={14} /> Xoá
            </button>
            {!s.can_delete && (
              <p className="px-3 pb-1.5 pl-[34px] text-[11px] leading-snug text-ink-faint">
                Đã dùng {s.total_uses} lần, chỉ ngừng bán được
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
