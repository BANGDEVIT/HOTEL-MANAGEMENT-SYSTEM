import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, RotateCw } from "lucide-react";
import { useAuthStore } from "../auth/store/authStore";
import { useRoomTypeStore } from "./store/roomTypeStore";
import RoomTypeStatsCards from "./components/RoomTypeStatsCards";
import RoomTypeToolbar from "./components/RoomTypeToolbar";
import RoomTypeCard, { type RoomTypeAction } from "./components/RoomTypeCard";
import RoomTypeFormDialog, {
  type RoomTypeFormTarget,
} from "./components/RoomTypeFormDialog";
import {
  DeleteRoomTypeDialog,
  ToggleRoomTypeDialog,
} from "./components/RoomTypeConfirmDialogs";
import type { RoomTypeItem } from "../../types/roomType";
import { visibleRoomTypes } from "./utils/roomTypeMeta";

const MANAGER_ROLES = ["manager", "admin"];
/** Mảng rỗng cố định: selector Zustand không được trả mảng mới mỗi lần */
const NO_ROLES: string[] = [];
const time = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

type Confirm = { kind: "toggle" | "delete"; roomType: RoomTypeItem } | null;

/**
 * Trang Loại phòng.
 * - Quản lý / admin: thêm, sửa, bật tắt kinh doanh, xoá (chỉ khi chưa có phòng).
 * - Lễ tân: chỉ xem để tư vấn khách. Nút bị ẩn trên FE cho gọn, BE vẫn chặn bằng @Roles.
 */
export default function RoomTypeManagement() {
  const items = useRoomTypeStore((s) => s.items);
  const filters = useRoomTypeStore((s) => s.filters);
  const loading = useRoomTypeStore((s) => s.loading);
  const lastUpdated = useRoomTypeStore((s) => s.lastUpdated);
  const fetch = useRoomTypeStore((s) => s.fetch);
  const upsert = useRoomTypeStore((s) => s.upsert);
  const remove = useRoomTypeStore((s) => s.remove);
  const resetFilters = useRoomTypeStore((s) => s.resetFilters);

  const roles = useAuthStore((s) => s.user?.roles) ?? NO_ROLES;
  const canManage = roles.some((r) => MANAGER_ROLES.includes(r));

  const [formTarget, setFormTarget] = useState<RoomTypeFormTarget | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const visible = useMemo(() => visibleRoomTypes(items, filters), [items, filters]);
  const activeCount = items.filter((t) => t.is_active).length;
  const roomCount = items.reduce((s, t) => s + t.rooms.total, 0);

  const handleAction = (action: RoomTypeAction, t: RoomTypeItem) => {
    if (action === "edit") setFormTarget({ mode: "edit", roomType: t });
    else setConfirm({ kind: action, roomType: t });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-gold-700">
            Quản trị
          </p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-tight text-navy-900">
            Loại phòng
          </h1>
          <p className="mt-1 text-[13px] tabular-nums text-ink-secondary">
            {loading && !lastUpdated
              ? "Đang tải loại phòng"
              : `${items.length} loại, ${activeCount} đang kinh doanh · ${roomCount} phòng · đổi giá chỉ áp dụng cho đặt phòng mới${
                  lastUpdated ? `, cập nhật lúc ${time(lastUpdated)}` : ""
                }`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetch()}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-line-input bg-white px-3.5 text-[13.5px] font-medium text-navy-700 hover:border-navy-700 disabled:opacity-50"
          >
            <RotateCw
              size={14}
              className={loading ? "animate-spin" : ""}
            />{" "}
            Làm mới
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setFormTarget({ mode: "create" })}
              className="flex h-10 items-center gap-2 rounded-[10px] bg-navy-700 px-4 text-[14px] font-semibold text-white hover:bg-navy-hover"
            >
              <Plus
                size={15}
                strokeWidth={2}
              />{" "}
              Thêm loại phòng
            </button>
          )}
        </div>
      </div>

      <RoomTypeStatsCards />

      {!canManage && (
        <p className="flex items-center gap-2 rounded-[12px] border border-line bg-white px-4 py-2.5 text-[12.5px] text-ink-muted">
          <Lock
            size={14}
            className="shrink-0"
          />{" "}
          Bạn đang xem với quyền lễ tân: xem được giá, sức chứa, tiện nghi để tư vấn
          khách. Thêm, sửa, ngừng kinh doanh do quản lý thực hiện.
        </p>
      )}

      <RoomTypeToolbar shown={visible.length} />

      {/* ===== Lưới thẻ ===== */}
      {loading && !lastUpdated ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">
          Đang tải loại phòng
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-[16px] border border-line bg-white px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-ink">
            {items.length ? "Không có loại phòng phù hợp" : "Chưa có loại phòng nào"}
          </p>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 text-[12.5px] font-medium text-navy-700 hover:underline"
            >
              Xoá bộ lọc
            </button>
          ) : (
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Tạo loại phòng trước, rồi thêm phòng ở trang Phòng.
            </p>
          )}
        </div>
      ) : (
        <div
          className={`grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5 transition-opacity ${
            loading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {visible.map((t: any) => (
            <RoomTypeCard
              key={t.id}
              roomType={t}
              canManage={canManage}
              onAction={handleAction}
            />
          ))}
          {canManage && !filters.search && filters.status !== "inactive" && (
            <button
              type="button"
              onClick={() => setFormTarget({ mode: "create" })}
              className="flex min-h-[300px] flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed border-line-input text-[13.5px] text-ink-muted transition-colors hover:border-navy-700 hover:bg-white hover:text-navy-700"
            >
              <Plus
                size={22}
                strokeWidth={1.8}
                aria-hidden="true"
              />{" "}
              Thêm loại phòng
            </button>
          )}
        </div>
      )}

      {/* ===== Hộp thoại ===== */}
      <RoomTypeFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={(t: any) => {
          setFormTarget(null);
          upsert(t);
        }}
      />
      {confirm?.kind === "toggle" && (
        <ToggleRoomTypeDialog
          roomType={confirm.roomType}
          onClose={() => setConfirm(null)}
          onDone={(t: any) => {
            setConfirm(null);
            upsert(t);
          }}
        />
      )}
      {confirm?.kind === "delete" && (
        <DeleteRoomTypeDialog
          roomType={confirm.roomType}
          onClose={() => setConfirm(null)}
          onDone={(id: any) => {
            setConfirm(null);
            remove(id);
          }}
        />
      )}
    </div>
  );
}
