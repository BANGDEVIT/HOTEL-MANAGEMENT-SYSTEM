import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import { useEmployeeStore } from "./store/employeeStore";
import EmployeeRow, { EMPLOYEE_GRID } from "./components/EmployeeRow";
import EmployeeForm from "./components/EmployeeForm";
import type { Employee, EmployeeRole } from "../../types/employee";
import { ROLE_LABELS, ROLE_ORDER, primaryRole } from "../../types/employee";

type StatusFilter = "all" | "active" | "locked";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Đang làm" },
  { value: "locked", label: "Đã khoá" },
];

export default function EmployeeManagement() {
  const { employees, loading, filters, setFilters, fetchEmployees } =
    useEmployeeStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.search) setFilters({ search: searchInput });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const firstLoad = loading && employees.length === 0;
  const activeCount = employees.filter((e) => e.account.is_active).length;

  // Lọc trạng thái ở FE — danh sách đã tải hết (limit 100)
  const visible = employees.filter((e) =>
    status === "all"
      ? true
      : status === "active"
        ? e.account.is_active
        : !e.account.is_active,
  );

  // Nhóm theo vai trò, theo thứ tự admin → manager → staff
  const groups = ROLE_ORDER.map((role) => ({
    role,
    list: visible.filter((e) => primaryRole(e) === role),
  })).filter((g) => g.list.length > 0);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (e: Employee) => {
    setEditTarget(e);
    setFormOpen(true);
  };
  const clearSearch = () => {
    setSearchInput("");
    setFilters({ search: "" });
  };

  return (
    <div>
      <div className="relative bg-white border border-line rounded-[10px]">
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-[10px] z-10">
          <LoadingBar active={loading} />
        </div>

        {/* Tiêu đề */}
        <div className="px-5 py-4 flex items-start justify-between border-b border-line">
          <div>
            <h1 className="text-[19px] font-semibold text-ink tracking-[-0.01em]">
              Nhân viên
            </h1>
            <p className="text-[12px] text-ink-muted mt-0.5 tabular-nums">
              {firstLoad
                ? "Đang tải danh sách nhân viên…"
                : `${employees.length} người, ${activeCount} đang làm`}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="h-[34px] px-3.5 rounded-md bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-hover flex items-center gap-1.5"
          >
            <Plus
              size={14}
              strokeWidth={2}
            />
            Thêm nhân viên
          </button>
        </div>

        {/* Lọc + tìm */}
        <div className="px-5 py-2.5 border-b border-line flex items-center gap-1.5">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setStatus(chip.value)}
              className={`h-7 px-3 rounded-md text-[12px] border transition-colors
                ${
                  status === chip.value
                    ? "bg-[#14181D] text-white border-[#14181D]"
                    : "bg-white text-ink-secondary border-line hover:border-line-input"
                }`}
            >
              {chip.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-2 h-7 px-2.5 border border-line rounded-md w-[240px] focus-within:border-navy-700">
              <Search
                size={13}
                strokeWidth={1.75}
                className="text-ink-muted shrink-0"
              />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tên, email, điện thoại"
                className="text-[12px] outline-none w-full bg-transparent text-ink"
              />
            </div>
            {filters.search && (
              <button
                onClick={clearSearch}
                aria-label="Bỏ tìm kiếm"
                className="h-7 w-7 flex items-center justify-center border border-line rounded-md text-ink-muted hover:text-ink hover:bg-row-hover"
              >
                <X
                  size={13}
                  strokeWidth={1.75}
                />
              </button>
            )}
          </div>
        </div>

        {/* Nội dung */}
        {firstLoad ? (
          <SkeletonRows />
        ) : groups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[13px] text-ink-secondary mb-3">
              {filters.search
                ? "Không có nhân viên nào khớp từ khoá."
                : status === "locked"
                  ? "Không có tài khoản nào đang bị khoá."
                  : "Chưa có nhân viên nào."}
            </p>
            {filters.search ? (
              <button
                onClick={clearSearch}
                className="h-8 px-4 rounded-md border border-line text-[12px] text-ink hover:bg-row-hover"
              >
                Bỏ tìm kiếm
              </button>
            ) : status === "all" ? (
              <button
                onClick={openCreate}
                className="h-8 px-4 rounded-md border border-line text-[12px] text-ink hover:bg-row-hover"
              >
                Thêm nhân viên
              </button>
            ) : null}
          </div>
        ) : (
          <div
            className={`transition-opacity duration-150 ${loading ? "opacity-40 pointer-events-none" : ""}`}
          >
            <div
              className="grid items-center gap-3 h-[36px] px-4 bg-[#FAFBFB] border-b border-line text-[12px] text-ink-muted"
              style={{ gridTemplateColumns: EMPLOYEE_GRID }}
            >
              <span>Nhân viên</span>
              <span>Điện thoại</span>
              <span>Thâm niên</span>
              <span>Lương</span>
              <span>Trạng thái</span>
              <span />
            </div>

            {groups.map(({ role, list }, gi) => (
              <GroupSection
                key={role}
                role={role}
                list={list}
                isLast={gi === groups.length - 1}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      <EmployeeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        employee={editTarget}
      />
    </div>
  );
}

function GroupSection({
  role,
  list,
  isLast,
  onEdit,
}: {
  role: EmployeeRole;
  list: Employee[];
  isLast: boolean;
  onEdit: (e: Employee) => void;
}) {
  const active = list.filter((e) => e.account.is_active).length;

  return (
    <div className={isLast ? "[&>div:last-child]:border-b-0" : ""}>
      <div className="flex items-center gap-2.5 px-4 py-2 bg-[#FAFBFB] border-b border-line">
        <b className="text-[12px] font-semibold text-ink">{ROLE_LABELS[role]}</b>
        <div className="flex-1 h-px bg-[#E4E6E9]" />
        <span className="text-[11px] text-ink-muted tabular-nums">
          {list.length} người
          {active < list.length ? `, ${list.length - active} đã khoá` : ""}
        </span>
      </div>
      {list.map((e) => (
        <EmployeeRow
          key={e.id}
          employee={e}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center gap-3 min-h-[56px] px-4 border-b border-line-soft last:border-b-0"
          style={{ gridTemplateColumns: EMPLOYEE_GRID }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#F0F1F3] animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-28 h-3 bg-[#F0F1F3] rounded animate-pulse" />
              <div className="w-40 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
            </div>
          </div>
          <div className="w-20 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
          <div className="w-16 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
          <div className="w-16 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
          <div className="w-14 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
          <span />
        </div>
      ))}
    </div>
  );
}
