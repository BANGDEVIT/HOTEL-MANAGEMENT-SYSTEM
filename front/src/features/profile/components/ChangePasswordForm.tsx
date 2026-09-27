import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useProfileStore } from "../store/profileStore";
import { Field, INPUT } from "./ProfileInfoForm";

const schema = z
  .object({
    current_password: z.string().min(1, "Nhập mật khẩu hiện tại"),
    new_password: z
      .string()
      .min(8, "Ít nhất 8 ký tự")
      .max(72, "Tối đa 72 ký tự")
      .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Phải có cả chữ và số"),
    confirm_password: z.string().min(1, "Nhập lại mật khẩu mới"),
  })
  // refine: kiểm tra liên quan tới NHIỀU field. path chỉ định lỗi hiện dưới ô nào.
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirm_password"],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
    path: ["new_password"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function ChangePasswordForm() {
  const changePassword = useProfileStore((s) => s.changePassword);
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const onSubmit = async ({ current_password, new_password }: FormValues) => {
    try {
      // CHỈ gửi 2 field. Gửi cả confirm_password thì BE trả 400,
      // vì ValidationPipe đang bật forbidNonWhitelisted
      await changePassword({ current_password, new_password });
      reset(EMPTY); // xoá sạch 3 ô, không để mật khẩu nằm lại trên màn hình
      setShow(false);
      toast.success("Đã đổi mật khẩu");
    } catch {
      // store đã báo lỗi
    }
  };

  const type = show ? "text" : "password";
  const cls = (hasError: boolean) =>
    `${INPUT} ${hasError ? "border-[#B4321F]" : "border-[#E4E6E9]"}`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="px-5 pt-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-[#14181D]">Đổi mật khẩu</h2>
          <p className="text-[12px] text-[#98A1AC] mt-0.5">
            Dùng mật khẩu bạn không dùng ở nơi khác.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="h-7 px-2.5 rounded-md text-[12px] text-[#5C6672] hover:bg-[#F5F6F7] flex items-center gap-1.5"
        >
          {show ? (
            <EyeOff
              size={13}
              strokeWidth={1.75}
            />
          ) : (
            <Eye
              size={13}
              strokeWidth={1.75}
            />
          )}
          {show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>
      </div>

      <div className="px-5 pt-3.5 pb-4 grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field
          label="Mật khẩu hiện tại"
          error={errors.current_password?.message}
          className="sm:col-span-2"
        >
          {/* autoComplete giúp trình quản lý mật khẩu điền đúng ô */}
          <input
            {...register("current_password")}
            type={type}
            autoComplete="current-password"
            className={cls(!!errors.current_password)}
          />
        </Field>

        <Field
          label="Mật khẩu mới"
          error={errors.new_password?.message}
          hint="Ít nhất 8 ký tự, có cả chữ và số"
        >
          <input
            {...register("new_password")}
            type={type}
            autoComplete="new-password"
            className={cls(!!errors.new_password)}
          />
        </Field>

        <Field
          label="Nhập lại mật khẩu mới"
          error={errors.confirm_password?.message}
        >
          <input
            {...register("confirm_password")}
            type={type}
            autoComplete="new-password"
            className={cls(!!errors.confirm_password)}
          />
        </Field>
      </div>

      <div className="px-5 pb-4 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-8 px-3.5 rounded-md bg-[#1B3A5C] text-white text-[12.5px] font-medium hover:bg-[#0F2440] disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Đang đổi" : "Đổi mật khẩu"}
        </button>
      </div>
    </form>
  );
}
