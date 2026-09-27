import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Lock, MoreHorizontal, Pencil, Unlock } from "lucide-react";
import { toast } from "sonner";
import type { Employee } from "../../../types/employee";
import { ROLE_LABELS, initials, primaryRole, tenure } from "../../../types/employee";
import { useEmployeeStore } from "../store/employeeStore";
import { useAuthStore } from "../../auth/store/authStore";
import SalaryCell from "./SalaryCell";

// 6 cột: nhân viên | điện thoại | thâm niên | lương | trạng thái | menu
export const EMPLOYEE_GRID = "minmax(0,1fr) 116px 112px 120px 96px 36px";
const MENU_WIDTH = 204;

type Confirm = "lock" | "reset" | null;

export default function EmployeeRow({
  employee,
  onEdit,
}: {
  employee: Employee;
  onEdit: (e: Employee) => void;
}) {
  const { lockEmployee, unlockEmployee, resetPassword } = useEmployeeStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = employee.account.is_active;
  const role = primaryRole(employee);
  const fullName = `${employee.last_name} ${employee.first_name}`;
  // Không cho tự khoá chính mình
  const isSelf = employee.account.id === currentUserId;

  useLayoutEffect(() => {
    if (!menuOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const btn = btnRef.current.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? 160;
    const up = window.innerHeight - btn.bottom < h + 12;
    setPos({
      top: up ? btn.top - h - 4 : btn.bottom + 4,
      left: Math.max(8, btn.right - MENU_WIDTH),
    });
  }, [menuOpen, confirm]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeAll = () => {
      setMenuOpen(false);
      setConfirm(null);
    };
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      closeAll();
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", closeAll, true);
    window.addEventListener("resize", closeAll);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", closeAll, true);
      window.removeEventListener("resize", closeAll);
    };
  }, [menuOpen]);

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      setMenuOpen(false);
    } catch {
      // store đã báo lỗi
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <div
      className={`grid items-center gap-3 min-h-[56px] px-4 border-b border-line-soft hover:bg-row-hover transition-colors
        ${active ? "" : "opacity-60"}`}
      style={{ gridTemplateColumns: EMPLOYEE_GRID }}
    >
      {/* 1. Nhân viên */}
      <div className="flex items-center gap-2.5 min-w-0">
        {employee.avatar_url ? (
          <img
            src={employee.avatar_url}
            alt=""
            className={`w-8 h-8 rounded-full object-cover shrink-0 ${active ? "" : "grayscale"}`}
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold
              ${active ? "bg-navy-700 text-white" : "bg-[#E4E6E9] text-ink-muted"}`}
          >
            {initials(employee)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink truncate">
            {fullName}
            {isSelf && (
              <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                (bạn)
              </span>
            )}
          </p>
          <p className="text-[12px] text-ink-muted truncate">
            {employee.account.email}
            {employee.position && `, ${employee.position}`}
          </p>
        </div>
      </div>

      {/* 2. Điện thoại */}
      <span className="text-[12px] text-ink-secondary tabular-nums">
        {employee.phone}
      </span>

      {/* 3. Thâm niên — ngày cụ thể khi rê chuột */}
      <span
        className="text-[12px] text-ink-secondary"
        title={`Vào làm ${new Date(employee.hired_date).toLocaleDateString("vi-VN")}`}
      >
        {tenure(employee.hired_date)}
      </span>

      {/* 4. Lương */}
      <SalaryCell salary={employee.salary} />

      {/* 5. Trạng thái */}
      <span
        className={`flex items-center gap-1.5 text-[12px] ${active ? "text-[#0E7C5A]" : "text-ink-muted"}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {active ? "Đang làm" : "Đã khoá"}
      </span>

      {/* 6. Menu */}
      <div className="justify-self-center">
        <button
          ref={btnRef}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={`Thao tác với ${fullName}`}
          className="w-7 h-7 flex items-center justify-center rounded text-ink-muted hover:bg-[#E4E6E9] hover:text-ink"
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
              className="z-50 bg-white border border-line rounded-lg overflow-hidden shadow-[0_4px_12px_rgba(20,24,29,.10)]"
            >
              <div className="px-3 py-2 border-b border-line-soft">
                <p className="text-[12px] font-medium text-ink truncate">
                  {fullName}
                </p>
                <p className="text-[11px] text-ink-muted">{ROLE_LABELS[role]}</p>
              </div>

              {confirm ? (
                <div className="p-2.5">
                  <p className="text-[11px] text-ink-secondary mb-2 leading-snug">
                    {confirm === "lock"
                      ? `Khoá tài khoản ${fullName}? Người này sẽ không đăng nhập được nữa.`
                      : `Đặt lại mật khẩu của ${fullName} về mật khẩu mặc định?`}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      disabled={busy}
                      onClick={() =>
                        confirm === "lock"
                          ? run(
                              () => lockEmployee(employee.id),
                              `Đã khoá tài khoản ${fullName}`,
                            )
                          : run(
                              () => resetPassword(employee.id),
                              `Đã đặt lại mật khẩu cho ${fullName}`,
                            )
                      }
                      className={`flex-1 h-7 rounded-md text-white text-[11px] font-medium disabled:opacity-60
                        ${confirm === "lock" ? "bg-destructive" : "bg-navy-700"}`}
                    >
                      {confirm === "lock" ? "Khoá" : "Đặt lại"}
                    </button>
                    <button
                      onClick={() => setConfirm(null)}
                      className="flex-1 h-7 rounded-md border border-line text-[11px] text-ink-secondary"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <MenuItem
                    icon={
                      <Pencil
                        size={13}
                        strokeWidth={1.75}
                      />
                    }
                    label="Sửa thông tin"
                    onClick={() => {
                      onEdit(employee);
                      setMenuOpen(false);
                    }}
                  />
                  <MenuItem
                    icon={
                      <KeyRound
                        size={13}
                        strokeWidth={1.75}
                      />
                    }
                    label="Đặt lại mật khẩu"
                    onClick={() => setConfirm("reset")}
                  />
                  {!isSelf && (
                    <div className="border-t border-line-soft">
                      {active ? (
                        <MenuItem
                          danger
                          icon={
                            <Lock
                              size={13}
                              strokeWidth={1.75}
                            />
                          }
                          label="Khoá tài khoản"
                          onClick={() => setConfirm("lock")}
                        />
                      ) : (
                        <MenuItem
                          icon={
                            <Unlock
                              size={13}
                              strokeWidth={1.75}
                            />
                          }
                          label="Mở khoá tài khoản"
                          onClick={() =>
                            run(
                              () => unlockEmployee(employee.id),
                              `Đã mở khoá ${fullName}`,
                            )
                          }
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px]
        ${danger ? "text-[#B4321F] hover:bg-[#FEF2F2]" : "text-ink hover:bg-row-hover"}`}
    >
      <span className={danger ? "" : "text-ink-muted"}>{icon}</span>
      {label}
    </button>
  );
}
