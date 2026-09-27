import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginformValues } from "@/types/auth";

interface LoginFormProps {
  onSubmit: (values: LoginformValues) => Promise<void>;
  isLoading: boolean;
}

export default function LoginForm({ onSubmit, isLoading }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginformValues>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
    >
      <div>
        <label className="block text-[14px] font-medium text-[#0A0A0A] mb-2">
          Email
        </label>
        <input
          {...register("email")}
          type="email"
          placeholder="you@example.com"
          className={`w-full px-4 py-3 rounded-lg border text-[15px] outline-none
        focus:ring-2 focus:ring-[#1B3A5C]/10
        ${errors.email ? "border-red-400" : "border-[#E2E2D8] focus:border-navy-700"}`}
        />
        {errors.email && (
          <p className="text-red-600 text-[13px] mt-1.5">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-[14px] font-medium text-[#0A0A0A] mb-2">
          Mật khẩu
        </label>
        <input
          {...register("password")}
          type="password"
          placeholder="••••••••"
          className={`w-full px-4 py-3 rounded-lg border text-[15px] outline-none
        focus:ring-2 focus:ring-[#1B3A5C]/10
        ${errors.password ? "border-red-400" : "border-[#E2E2D8] focus:border-navy-700"}`}
        />
        {errors.password && (
          <p className="text-red-600 text-[13px] mt-1.5">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-navy-700 text-white py-3 rounded-lg text-[15px]
      font-medium hover:bg-navy-hover disabled:opacity-60 transition-colors"
      >
        {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}

// LoginForm chỉ nhận props: onSubmit, isLoading, serverError
// → Nó KHÔNG tự gọi authStore, KHÔNG tự navigate
// → Nó chỉ validate form (bằng Zod) rồi GỌI NGƯỢC LÊN
//   qua onSubmit(values) khi user bấm submit hợp lệ

// → Lợi ích: nếu sau này cần y hệt form này ở chỗ khác
//   (vd: modal "Đăng nhập nhanh" ngay trên trang chủ),
//   chỉ cần truyền onSubmit khác, không phải viết lại form
