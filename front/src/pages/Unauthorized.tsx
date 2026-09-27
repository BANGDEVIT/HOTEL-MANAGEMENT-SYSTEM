import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, LogOut } from "lucide-react";
import { useAuthStore } from "../features/auth/store/authStore";
import { ROLE_LABELS } from "../types/employee";

/** Tên tiếng Việt của từng trang, để câu giải thích nói được "trang Nhân viên" */
const PAGE_NAMES: Record<string, string> = {
  "/admin/dashboard": "Tổng quan",
  "/admin/employees": "Nhân viên",
  "/admin/shifts": "Ca làm việc",
  "/admin/room-types": "Loại phòng",
  "/admin/services": "Dịch vụ",
  "/admin/rooms": "Phòng",
  "/admin/customers": "Khách hàng",
  "/admin/bookings": "Đặt phòng",
  "/admin/invoices": "Hoá đơn",
  "/admin/payments": "Thanh toán",
};

// ROLE_LABELS chỉ có 3 role nhân viên -> bổ sung customer.
// Kiểu Record<string, string> để tra bằng chuỗi bất kỳ mà TypeScript không báo lỗi.
const ALL_ROLE_LABELS: Record<string, string> = {
  ...ROLE_LABELS,
  customer: "Khách hàng",
};
const RANK = ["admin", "manager", "staff", "customer"];

/** ProtectedRoute gửi kèm khi chuyển hướng sang đây */
interface DeniedState {
  from?: string; // trang người dùng định vào
  roles?: string[]; // các role được phép vào trang đó
}

/** Trang "nhà" của từng loại tài khoản */
function homeFor(roles: string[]): string {
  if (roles.includes("admin") || roles.includes("manager")) return "/admin/rooms";
  if (roles.includes("staff")) return "/admin/my-shifts";
  return "/";
}

/** "Quản trị viên, Quản lý hoặc Nhân viên" */
function joinRoles(roles: string[]): string {
  const labels = roles.map((r) => ALL_ROLE_LABELS[r] ?? r);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} hoặc ${labels[labels.length - 1]}`;
}

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Vào thẳng bằng URL thì state là null -> dùng {} để không bị lỗi khi đọc
  const { from, roles: allowed } = (location.state ?? {}) as DeniedState;

  const myRoles = user?.roles ?? [];
  const myTopRole = RANK.find((r) => myRoles.includes(r));
  const pageName = from ? PAGE_NAMES[from] : undefined;

  // react-router gán key "default" cho trang ĐẦU TIÊN mở trong tab.
  // Mở trang này trực tiếp thì không có trang trước để quay lại -> ẩn nút.
  const canGoBack = location.key !== "default";

  const handleSwitchAccount = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.fullname
    ? user.fullname
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <main className="min-h-screen bg-[#F5F6F7] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="bg-white border border-[#E4E6E9] rounded-[12px] overflow-hidden shadow-[0_1px_2px_rgba(20,24,29,.04)]">
          <div className="px-8 pt-9 pb-6 text-center">
            <DoorPlate />

            <p className="text-[12px] text-[#98A1AC] mt-6 tabular-nums">Lỗi 403</p>
            <h1 className="text-[20px] font-semibold text-[#14181D] tracking-[-0.01em] mt-1">
              Bạn không có quyền vào trang này
            </h1>
            <p className="text-[13px] text-[#5C6672] leading-relaxed mt-2">
              <Explanation
                pageName={pageName}
                allowed={allowed}
                myRole={myTopRole}
              />
            </p>
          </div>

          <div className="px-8 pb-7 flex flex-col gap-2">
            <button
              type="button"
              // replace: không để trang lỗi nằm lại trong lịch sử trình duyệt
              onClick={() => navigate(homeFor(myRoles), { replace: true })}
              className="h-[38px] rounded-[7px] bg-[#1B3A5C] text-white text-[13px] font-medium hover:bg-[#0F2440]"
            >
              Về trang của tôi
            </button>

            {canGoBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="h-[38px] rounded-[7px] border border-[#E4E6E9] bg-white text-[13px] text-[#14181D] hover:bg-[#F5F6F7] flex items-center justify-center gap-1.5"
              >
                <ArrowLeft
                  size={14}
                  strokeWidth={1.75}
                />
                Quay lại trang trước
              </button>
            )}
          </div>

          {/* Đang đăng nhập bằng tài khoản nào: hay gặp trang này khi đăng nhập nhầm */}
          {user && (
            <div className="border-t border-[#E4E6E9] bg-[#F5F6F7] px-8 py-3.5 flex items-center gap-3">
              <span className="w-8 h-8 shrink-0 rounded-full bg-[#1B3A5C] text-white text-[12px] font-semibold flex items-center justify-center">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#14181D] truncate">
                  {user.fullname ?? user.email}
                </div>
                <div className="text-[11.5px] text-[#98A1AC]">
                  {myTopRole ? ALL_ROLE_LABELS[myTopRole] : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="ml-auto shrink-0 h-8 px-2 rounded-md text-[12px] text-[#5C6672] flex items-center gap-1.5 hover:bg-white hover:text-[#B4321F]"
              >
                <LogOut
                  size={13}
                  strokeWidth={2}
                />
                Đổi tài khoản
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[12px] text-[#98A1AC] mt-4">
          Cần thêm quyền? Liên hệ quản lý khách sạn.
        </p>
      </div>
    </main>
  );
}

/** Chữ in đậm trong câu giải thích. Khai báo 1 lần ở ngoài -> React luôn thấy CÙNG 1 component */
function B({ children }: { children: React.ReactNode }) {
  return <b className="font-medium text-[#14181D]">{children}</b>;
}

/** Câu giải thích: nói được càng cụ thể càng tốt, tuỳ theo có bao nhiêu thông tin */
function Explanation({
  pageName,
  allowed,
  myRole,
}: {
  pageName?: string;
  allowed?: string[];
  myRole?: string;
}) {
  // Đủ cả 3 thông tin: nói rõ nhất
  if (pageName && allowed?.length && myRole) {
    return (
      <>
        Trang <B>{pageName}</B> chỉ dành cho <B>{joinRoles(allowed)}</B>. Tài khoản
        của bạn đang là <B>{ALL_ROLE_LABELS[myRole]}</B>.
      </>
    );
  }
  // Biết trang nhưng không biết ai được vào
  if (pageName) {
    return (
      <>
        Tài khoản của bạn không được mở trang <B>{pageName}</B>.
      </>
    );
  }
  // Vào thẳng /unauthorized, không có thông tin gì
  return <>Tài khoản của bạn không có quyền xem nội dung này.</>;
}

/** Tấm biển gắn cửa "Khu vực hạn chế", vẽ bằng CSS, không cần file ảnh */
function DoorPlate() {
  const screw = "absolute w-[5px] h-[5px] rounded-full bg-[#9DB4D1]/70";
  return (
    <div
      aria-hidden="true" // chỉ để trang trí -> trình đọc màn hình bỏ qua
      className="mx-auto w-[176px] h-24 rounded-[10px] bg-[#1B3A5C] p-[5px] shadow-[0_8px_20px_rgba(15,36,64,.18)]"
    >
      <div className="relative h-full rounded-[7px] border border-[#9DB4D1]/45 flex flex-col items-center justify-center">
        <span className={`${screw} top-1.5 left-1.5`} />
        <span className={`${screw} top-1.5 right-1.5`} />
        <span className={`${screw} bottom-1.5 left-1.5`} />
        <span className={`${screw} bottom-1.5 right-1.5`} />
        <Lock
          size={20}
          strokeWidth={1.75}
          className="text-white"
        />
        <span className="mt-1.5 text-[12.5px] font-semibold text-white">
          Khu vực hạn chế
        </span>
        <span className="text-[10.5px] text-[#9DB4D1]">Chỉ người có phận sự</span>
      </div>
    </div>
  );
}
