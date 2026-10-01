import { useEffect, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BedDouble,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ConciergeBell,
  IdCard,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../features/auth/store/authStore";
import { useMyShiftStore } from "../features/shifts/store/myShiftStore";
import { ROLE_LABELS, ROLE_ORDER } from "../types/employee";
import { SHIFT_LABELS } from "../types/shift";

/* ============================================================
 *  CẤU HÌNH MENU
 *  Thêm trang mới = thêm 1 dòng ở đây, không phải sửa JSX
 * ============================================================ */

type Role = "admin" | "manager" | "staff";

interface NavItem {
  label: string;
  path: string; // luôn có "/" đầu
  icon: LucideIcon; // truyền component icon, không phải chuỗi emoji
  roles: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const EVERYONE: Role[] = ["admin", "manager", "staff"];
const MANAGERS: Role[] = ["admin", "manager"];

const NAV: NavGroup[] = [
  {
    label: "Vận hành",
    items: [
      {
        label: "Tổng quan",
        path: "/admin/dashboard",
        icon: LayoutDashboard,
        roles: EVERYONE,
      },
      {
        label: "Lịch của tôi",
        path: "/admin/my-shifts",
        icon: CalendarClock,
        roles: EVERYONE,
      },
      {
        label: "Đặt phòng",
        path: "/admin/bookings",
        icon: CalendarDays,
        roles: EVERYONE,
      },
      { label: "Phòng", path: "/admin/rooms", icon: BedDouble, roles: EVERYONE },
      {
        label: "Khách hàng",
        path: "/admin/customers",
        icon: Users,
        roles: EVERYONE,
      },
      {
        label: "Hoá đơn",
        path: "/admin/invoices",
        icon: ReceiptText,
        roles: EVERYONE,
      },
      // {
      //   label: "Thanh toán",
      //   path: "/admin/payments",
      //   icon: CreditCard,
      //   roles: EVERYONE,
      // },
    ],
  },
  {
    label: "Quản trị",
    items: [
      {
        label: "Nhân viên",
        path: "/admin/employees",
        icon: IdCard,
        roles: MANAGERS,
      },
      {
        label: "Ca làm việc",
        path: "/admin/shifts",
        icon: CalendarRange,
        roles: MANAGERS,
      },
      {
        label: "Loại phòng",
        path: "/admin/room-types",
        icon: Tags,
        roles: MANAGERS,
      },
      {
        label: "Dịch vụ",
        path: "/admin/services",
        icon: ConciergeBell,
        roles: MANAGERS,
      },
    ],
  },
];

/* ============================================================
 *  LAYOUT
 * ============================================================ */

export default function AdminLayout({ children }: { children: ReactNode }) {
  const roles = useAuthStore((s) => s.user?.roles ?? []);

  // Chỉ giữ mục user có quyền, nhóm nào trống thì bỏ luôn nhóm đó
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.roles.some((r) => roles.includes(r))),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-screen bg-cream-100">
      <aside className="w-[232px] shrink-0 bg-navy-900 flex flex-col gap-7 px-4 py-6 overflow-y-auto">
        <Brand />

        <nav
          aria-label="Điều hướng chính"
          className="flex flex-col gap-6"
        >
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3.5 mb-1.5 text-[12px] text-sidebar-subtle">
                {g.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <li key={item.path}>
                    <SidebarLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <UserCard />
      </aside>

      {/* Không còn header ngang: tên và vai trò đã ở thẻ dưới đáy sidebar */}
      <main className="flex-1 min-w-0 overflow-y-auto px-8 py-7">{children}</main>
    </div>
  );
}

/* ============================================================
 *  COMPONENT CON — khai báo ở cấp ngoài cùng file
 * ============================================================ */

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1.5">
      <span className="w-[38px] h-[38px] shrink-0 rounded-[10px] bg-gold-500 text-navy-900 font-display text-[19px] font-bold flex items-center justify-center">
        A
      </span>
      <div>
        <p className="text-[14px] font-semibold text-white leading-tight">
          Aurélien Hotel
        </p>
        <p className="text-[11.5px] text-sidebar-subtle mt-0.5">Bảng điều hành</p>
      </div>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  // Gán vào biến viết hoa để dùng được dạng <Icon />.
  // Đây KHÔNG phải tạo component mới, chỉ là lấy component đã có từ props.
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      // NavLink tự thêm aria-current="page" khi đang ở đúng trang
      className={({ isActive }) =>
        `flex items-center gap-3 h-11 px-3.5 rounded-[10px] text-[14px] transition-colors ${
          isActive
            ? "bg-gold-500 text-navy-900 font-semibold"
            : "text-sidebar-text font-medium hover:bg-white/[0.06] hover:text-white"
        }`
      }
    >
      <Icon
        size={18}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      {item.label}
    </NavLink>
  );
}

function UserCard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const nextShift = useMyShiftStore((s) => s.nextShift);
  const fetchNextShift = useMyShiftStore((s) => s.fetchNextShift);
  const navigate = useNavigate();

  const role = ROLE_ORDER.find((r) => user?.roles?.includes(r));

  // Có role nhân viên mới hỏi ca làm (tài khoản customer không vào layout này)
  useEffect(() => {
    if (role) fetchNextShift();
  }, [role, fetchNextShift]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const name = user?.fullname ?? user?.email ?? "";
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // "Quản lý, đang trong ca chiều"
  const onShift =
    nextShift?.status === "ongoing"
      ? `, đang trong ${SHIFT_LABELS[nextShift.shift.name].toLowerCase()}`
      : "";

  return (
    <div className="mt-auto flex items-center gap-1.5 rounded-[12px] bg-white/[0.06] p-2">
      <NavLink
        to="/admin/profile"
        title="Hồ sơ của tôi"
        className={({ isActive }) =>
          `flex items-center gap-2.5 min-w-0 flex-1 rounded-[9px] p-1 transition-colors hover:bg-white/[0.06] ${
            isActive ? "bg-white/[0.08]" : ""
          }`
        }
      >
        <span className="w-9 h-9 shrink-0 rounded-full bg-gold-50 text-navy-700 text-[12px] font-semibold flex items-center justify-center ring-2 ring-gold-500">
          {initials || "?"}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-white truncate">
            {name}
          </span>
          <span className="block text-[11.5px] text-sidebar-subtle truncate">
            {role ? ROLE_LABELS[role] : ""}
            {onShift}
          </span>
        </span>
      </NavLink>

      <button
        type="button"
        onClick={handleLogout}
        aria-label="Đăng xuất"
        title="Đăng xuất"
        className="w-9 h-9 shrink-0 rounded-[9px] flex items-center justify-center text-sidebar-subtle transition-colors hover:bg-destructive hover:text-white"
      >
        <LogOut
          size={16}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
