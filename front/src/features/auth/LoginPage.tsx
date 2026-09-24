import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "./store/authStore";
import type { LoginformValues } from "@/types/auth";
import LoginForm from "./components/LoginForm";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // error riêng của trang này — KHÔNG dùng chung error trong store,
  // vì store.error có thể bị các action khác (register, bootstrap) ghi đè

  const handleLogin = async (values: LoginformValues) => {
    try {
      await login(values); // chờ CẢ 2 API bên trong (login + getMe) chạy xong

      // Lấy state.from — nơi user ĐỊNH vào trước khi bị đá ra /login
      const from = (location.state as { from?: { pathname: string } })?.from
        ?.pathname;

      if (from) {
        // Ưu tiên 1: có "from" → quay lại đúng trang đó
        navigate(from, { replace: true });
        return;
      }

      // Ưu tiên 2: không có "from" → điều hướng theo role
      const { user } = useAuthStore.getState(); // lấy user MỚI NHẤT sau login
      const isStaffOrAbove = user?.roles?.some((r) =>
        ["staff", "manager", "admin"].includes(r),
      );

      toast.success("Đăng nhập thành công!");
      navigate(isStaffOrAbove ? "/admin/employees" : "/", { replace: true });
    } catch {
      toast.error("Đăng nhập thất bại", {
        description: "Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.",
      });
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #0F2440 0%, #1B3A5C 45%, #2E4A6B 75%, #C9A84C 140%)",
      }}
    >
      <div
        className="w-full max-w-5xl bg-white rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 ring-1 ring-white/10"
        style={{
          boxShadow:
            "0 30px 80px -12px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Panel trái */}
        <div className="hidden md:flex relative flex-col justify-between p-12 min-h-[600px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(18,35,58,0.55) 0%, rgba(18,35,58,0.88) 100%), url('/hero-hotel-room.jpg')",
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#C9A84C] flex items-center justify-center font-bold text-[14px] text-[#12233a]">
              A
            </div>
            <span className="text-white text-[15px] font-medium tracking-wide">
              Aurélien Hotel
            </span>
          </div>
          <div className="relative">
            <p className="text-white text-[30px] leading-snug font-medium mb-3">
              Nơi mỗi lần lưu trú
              <br />
              trở thành một câu chuyện.
            </p>
            <p className="text-white/65 text-[14px] leading-relaxed max-w-sm">
              Quản lý phòng, đặt chỗ và trải nghiệm khách hàng — tất cả trong một nền
              tảng duy nhất.
            </p>
          </div>
        </div>

        {/* Panel phải */}
        <div className="p-10 md:p-14 flex flex-col justify-center">
          <p className="text-[12px] font-semibold text-[#64748B] tracking-widest uppercase mb-2">
            Chào mừng trở lại
          </p>
          <h1 className="text-[26px] font-medium text-[#0A0A0A] mb-8">
            Đăng nhập tài khoản
          </h1>

          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading}
          />

          <p className="text-[13px] text-[#64748B] text-center mt-6">
            Chưa có tài khoản?{" "}
            <button
              onClick={() => navigate("/register")}
              className="text-[#C9A84C] font-semibold hover:underline"
            >
              Đăng ký ngay
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
