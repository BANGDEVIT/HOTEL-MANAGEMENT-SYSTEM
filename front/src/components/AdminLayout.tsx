import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { LogOut } from "lucide-react";
import { ROLE_LABELS, ROLE_ORDER } from "@/types/employee";

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: string[]; // role nào được thấy mục này
}

const OPERATION_ITEMS: NavItem[] = [
  {
    label: "Tổng quan",
    path: "/admin/dashboard",
    icon: "⊞",
    roles: ["admin", "manager", "staff"],
  },
  {
    label: "Nhân viên",
    path: "/admin/employees",
    icon: "👥",
    roles: ["admin", "manager"],
  },
  {
    label: "Ca làm việc",
    path: "/admin/shifts",
    icon: "🕐",
    roles: ["admin", "manager"],
  },
  {
    label: "Loại phòng",
    path: "/admin/room-types",
    icon: "🏷️",
    roles: ["admin", "manager"],
  },
  {
    label: "Dịch vụ",
    path: "/admin/services",
    icon: "🛎️",
    roles: ["admin", "manager"],
  },
];

const DAILY_ITEMS: NavItem[] = [
  {
    label: "Lịch của tôi",
    path: "/admin/my-shifts",
    icon: "📋",
    roles: ["admin", "manager", "staff"],
  },
  {
    label: "Phòng",
    path: "/admin/rooms",
    icon: "🚪",
    roles: ["admin", "manager", "staff"],
  },
  {
    label: "Khách hàng",
    path: "/admin/customers",
    icon: "🙋",
    roles: ["admin", "manager", "staff"],
  },
  {
    label: "Đặt phòng",
    path: "/admin/bookings",
    icon: "📅",
    roles: ["admin", "manager", "staff"],
  },
  {
    label: "Hoá đơn",
    path: "/admin/invoices",
    icon: "🧾",
    roles: ["admin", "manager", "staff"],
  },
  {
    label: "Thanh toán",
    path: "/admin/payments",
    icon: "💳",
    roles: ["admin", "manager", "staff"],
  },
];

interface Props {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Lọc menu theo role của user hiện tại — chỉ hiện mục user có quyền
  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => user?.roles?.some((r) => item.roles.includes(r)));

  const visibleOperationItems = filterByRole(OPERATION_ITEMS);
  const visibleDailyItems = filterByRole(DAILY_ITEMS);

  const initials = user?.fullname
    ? user.fullname
        .split(" ")
        .slice(-2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "?");

  const role = ROLE_ORDER.find((r) => user?.roles?.[0].includes(r));
  const roleLabel = role ? ROLE_LABELS[role] : "";

  return (
    <div className="flex h-screen bg-[#F7F7F5]">
      {/* ── Sidebar ────────────────────────────── */}
      <aside className="w-[240px] min-w-[240px] bg-[#1B3A5C] flex flex-col overflow-y-auto">
        <div className="px-4 py-[18px] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#C9A84C] rounded-lg flex items-center justify-center text-[#1B3A5C] font-bold text-sm">
              A
            </div>
            <div>
              <p className="text-white text-[13px] font-semibold leading-tight">
                Aurélien Hotel
              </p>
              <p className="text-[#9DB4D1] text-[10px] tracking-widest uppercase">
                Admin Console
              </p>
            </div>
          </div>
        </div>

        {/* Nhóm QUẢN TRỊ */}
        {visibleOperationItems.length > 0 && (
          <nav className="py-4">
            <p className="px-4 text-[10px] text-[#9DB4D1] tracking-[1.2px] uppercase font-medium mb-1">
              Quản trị
            </p>
            {visibleOperationItems.map((item) => (
              <SidebarLink
                key={item.path}
                {...item}
              />
            ))}
          </nav>
        )}

        {/* Nhóm VẬN HÀNH */}
        {visibleDailyItems.length > 0 && (
          <nav className="py-2">
            <p className="px-4 text-[10px] text-[#9DB4D1] tracking-[1.2px] uppercase font-medium mb-1">
              Vận hành
            </p>
            {visibleDailyItems.map((item) => (
              <SidebarLink
                key={item.path}
                {...item}
              />
            ))}
          </nav>
        )}

        {/* Nhóm TÀI KHOẢN — ai cũng thấy */}
        <nav className="py-2">
          <p className="px-4 text-[10px] text-[#9DB4D1] tracking-[1.2px] uppercase font-medium mb-1">
            Tài khoản
          </p>
          <SidebarLink
            label="Hồ sơ"
            path="/admin/profile"
            icon="👤"
            roles={[]}
          />
        </nav>

        {/* Footer — user thật + logout thật */}
        <div className="mt-auto border-t border-white/10">
          <div className="group px-4 py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#C9A84C] flex items-center justify-center text-[#1B3A5C] font-bold text-[13px] shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[13px] font-semibold truncate leading-tight">
                  {user?.fullname ?? user?.email}
                </p>
                <p className="text-[#C9A84C] text-[11px] mt-0.5">{roleLabel}</p>
              </div>
            </div>

            {/* Nút ẩn, chỉ hiện khi rê chuột vào khối trên */}
            <button
              onClick={handleLogout}
              className="w-full h-8 rounded-md flex items-center justify-center gap-2
                 text-[12px] font-medium
                 opacity-0 max-h-0 overflow-hidden
                 group-hover:opacity-100 group-hover:max-h-8
                 bg-[#B4321F] text-white hover:bg-[#8F2618]
                 transition-all duration-150"
            >
              <LogOut
                size={13}
                strokeWidth={2}
              />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-[#E2E2D8] flex items-center px-6 gap-4 flex-shrink-0">
          <span className="text-xs font-semibold text-[#64748B] tracking-widest uppercase">
            Aurélien Admin
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button className="w-9 h-9 rounded-full border border-[#E2E2D8] flex items-center justify-center text-[#64748B] hover:bg-[#F0F0EA] transition-colors">
              🔔
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white font-semibold text-sm">
                {initials}
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#0A0A0A]">
                  {user?.fullname ?? user?.email}
                </p>
                <p className="text-[11px] text-[#64748B]">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

// Sub-component cho 1 dòng menu — tách riêng vì logic NavLink lặp lại nhiều lần
function SidebarLink({ label, path, icon }: NavItem) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-4 py-[9px] text-[13px] border-l-2 transition-all
         ${
           isActive
             ? "text-white border-[#C9A84C] bg-white/[0.08]"
             : "text-[#9DB4D1] border-transparent hover:text-white hover:bg-white/[0.06]"
         }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  );
}
