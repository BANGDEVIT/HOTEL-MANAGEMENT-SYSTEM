import { useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import { useAuthStore } from "../auth/store/authStore";
import { useServiceStore } from "./store/serviceStore";
import ServiceStatsCards from "./components/ServiceStatsCards";
import ServiceToolbar from "./components/ServiceToolBar";
import ServiceTable from "./components/ServiceTable";
import ServiceInsights from "./components/ServiceInsights";
import DeleteServiceDialog from "./components/DeleteServiceDialog";
import Pagination from "../customer/components/Pagination";
import type { ServiceItem } from "../../types/service";
import type { ServiceFormTarget } from "./components/ServiceFormDialog";
import ServiceFormDialog from "./components/ServiceFormDialog";

const MANAGER_ROLES = ["manager", "admin"];
/** Mảng rỗng cố định: selector Zustand không được trả mảng mới mỗi lần */
const NO_ROLES: string[] = [];

/**
 * Trang Dịch vụ.
 * - Quản lý / admin: thêm, sửa, bật tắt đang bán, xoá (chỉ khi chưa từng dùng).
 * - Lễ tân: chỉ xem. Nút bị ẩn / khoá trên FE cho gọn, BE vẫn chặn bằng @Roles.
 */
export default function ServiceManagement() {
  const stats = useServiceStore((s) => s.stats);
  const totalPages = useServiceStore((s) => s.totalPages);
  const page = useServiceStore((s) => s.filters.page);
  const loading = useServiceStore((s) => s.loading);
  const lastUpdated = useServiceStore((s) => s.lastUpdated);
  const setFilters = useServiceStore((s) => s.setFilters);
  const refresh = useServiceStore((s) => s.refresh);
  const replaceItem = useServiceStore((s) => s.replaceItem);
  const fetchStats = useServiceStore((s) => s.fetchStats);

  const roles = useAuthStore((s) => s.user?.roles) ?? NO_ROLES;
  const canManage = roles.some((r) => MANAGER_ROLES.includes(r));

  const [formTarget, setFormTarget] = useState<ServiceFormTarget | null>(null);
  const [deleting, setDeleting] = useState<ServiceItem | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSaved = (service: ServiceItem, mode: ServiceFormTarget["mode"]) => {
    setFormTarget(null);
    if (mode === "edit") {
      replaceItem(service); // sửa: thay đúng dòng đó
      void fetchStats();
    } else {
      void refresh(); // thêm: dòng mới có thể nằm ở trang khác theo thứ tự sắp xếp
    }
  };

  const handleDeleted = (
    result: "removed" | "deactivated",
    service: ServiceItem,
  ) => {
    setDeleting(null);
    if (result === "deactivated") {
      replaceItem(service);
      void fetchStats();
    } else {
      void refresh();
    }
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
            Dịch vụ
          </h1>
          <p className="mt-1 text-[13px] tabular-nums text-ink-secondary">
            {stats
              ? `${stats.total} dịch vụ, ${stats.active} đang bán · đổi giá chỉ áp dụng cho lần dùng sau, hoá đơn cũ giữ nguyên`
              : "Đang tải dịch vụ"}
          </p>
        </div>
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
            Thêm dịch vụ
          </button>
        )}
      </div>

      <ServiceStatsCards />

      {!canManage && (
        <p className="flex items-center gap-2 rounded-[12px] border border-line bg-white px-4 py-2.5 text-[12.5px] text-ink-muted">
          <Lock size={14} /> Bạn đang xem với quyền lễ tân: chỉ xem được giá và tình
          trạng. Thêm, sửa, ngừng bán do quản lý thực hiện.
        </p>
      )}

      {/* ===== Danh sách ===== */}
      <section
        aria-label="Danh sách dịch vụ"
        className="overflow-hidden rounded-[16px] border border-line bg-white"
      >
        <ServiceToolbar />

        <div className="relative">
          <LoadingBar active={loading} />
          <div
            className={`transition-opacity ${loading && lastUpdated ? "pointer-events-none opacity-50" : ""}`}
          >
            <ServiceTable
              canManage={canManage}
              onEdit={(s) => setFormTarget({ mode: "edit", service: s })}
              onDelete={setDeleting}
            />
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line-soft px-[18px] py-3">
            <span className="text-[12.5px] tabular-nums text-ink-muted">
              Trang {page} trên {totalPages}
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              disabled={loading}
              onChange={(p) => setFilters({ page: p })}
            />
          </div>
        )}
      </section>

      <ServiceInsights />

      <ServiceFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={handleSaved}
      />
      {deleting && (
        <DeleteServiceDialog
          service={deleting}
          onClose={() => setDeleting(null)}
          onDone={handleDeleted}
        />
      )}
    </div>
  );
}
