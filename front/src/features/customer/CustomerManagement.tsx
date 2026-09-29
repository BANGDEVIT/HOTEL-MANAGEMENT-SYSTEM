import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import { useCustomerStore } from "./store/customerStore";
import CustomerStatsCards from "./components/CustomerStatsCards";
import CustomerToolbar from "./components/CustomerToolBar";
import CustomerTable from "./components/CustomerTable";
import Pagination from "./components/Pagination";
import CustomerDrawer from "./components/CustomerDrawer";
import CustomerFormDialog, {
  type FormTarget,
} from "./components/CustomerFormDialog";
import type { CustomerDetail } from "../../types/customer";

const time = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/**
 * Trang Khách hàng.
 * - Store: danh sách, bộ lọc, số liệu (nhiều component cùng dùng).
 * - State của trang: khách đang mở hồ sơ, form đang mở (chỉ trang này quan tâm).
 */
export default function CustomerManagement() {
  const stats = useCustomerStore((s) => s.stats);
  const total = useCustomerStore((s) => s.total);
  const totalPages = useCustomerStore((s) => s.totalPages);
  const page = useCustomerStore((s) => s.filters.page);
  const loading = useCustomerStore((s) => s.loading);
  const lastUpdated = useCustomerStore((s) => s.lastUpdated);
  const setFilters = useCustomerStore((s) => s.setFilters);
  const refresh = useCustomerStore((s) => s.refresh);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerVersion, setDrawerVersion] = useState(0); // tăng -> ngăn hồ sơ tải lại
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // useCallback: ngăn hồ sơ dùng hàm này trong useEffect (phím Esc), giữ tham chiếu ổn định
  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const handleSaved = (customer: CustomerDetail, mode: FormTarget["mode"]) => {
    setFormTarget(null);
    void refresh();
    setSelectedId(customer.id); // mở luôn hồ sơ vừa tạo / vừa sửa
    if (mode === "edit") setDrawerVersion((v) => v + 1);
  };

  const openExisting = (id: string) => {
    setFormTarget(null);
    setSelectedId(id);
  };

  const subtitle =
    loading && !lastUpdated
      ? "Đang tải danh sách khách"
      : `${stats?.total ?? total} khách, ${stats?.members ?? 0} khách có tài khoản thành viên${
          lastUpdated ? `, cập nhật lúc ${time(lastUpdated)}` : ""
        }`;

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-gold-700">
            Quản lý khách
          </p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-tight text-navy-900">
            Khách hàng
          </h1>
          <p className="mt-1 text-[13px] tabular-nums text-ink-secondary">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget({ mode: "create" })}
          className="flex h-10 items-center gap-2 rounded-[10px] bg-navy-700 px-4 text-[14px] font-semibold text-white hover:bg-navy-hover"
        >
          <Plus
            size={15}
            strokeWidth={2}
          />
          Thêm khách
        </button>
      </div>

      <CustomerStatsCards />

      {/* ===== Danh sách ===== */}
      <section
        aria-label="Danh sách khách hàng"
        className="overflow-hidden rounded-[16px] border border-line bg-white"
      >
        <CustomerToolbar />

        <div className="relative">
          <LoadingBar active={loading} />
          <div
            className={`transition-opacity ${loading && lastUpdated ? "pointer-events-none opacity-50" : ""}`}
          >
            <CustomerTable
              selectedId={selectedId}
              onSelect={setSelectedId}
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
              onChange={(p: any) => setFilters({ page: p })}
            />
          </div>
        )}
      </section>

      <CustomerDrawer
        customerId={selectedId}
        version={drawerVersion}
        onClose={closeDrawer}
        onEdit={(customer: any) => setFormTarget({ mode: "edit", customer })}
        onChanged={() => void refresh()}
      />

      <CustomerFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={handleSaved}
        onOpenExisting={openExisting}
      />
    </div>
  );
}
