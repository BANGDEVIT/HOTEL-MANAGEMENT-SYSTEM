import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { Employee } from "../../../types/employee";
import { GENDER_LABELS, GENDERS, toGender } from "../../../types/profile";
import { useProfileStore } from "../store/profileStore";

// Luật validate giống hệt UpdateProfileDto bên BE
const schema = z.object({
  last_name: z
    .string()
    .trim()
    .min(1, "Nhập họ và tên đệm")
    .max(50, "Tối đa 50 ký tự"),
  first_name: z.string().trim().min(1, "Nhập tên").max(50, "Tối đa 50 ký tự"),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Số điện thoại gồm 10 số, bắt đầu bằng 0"),
  gender: z.enum(["male", "female", "other"]),
});

type FormValues = z.infer<typeof schema>;

export const INPUT =
  "w-full h-9 px-3 rounded-md border text-[13px] text-ink outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#C9A84C]/40";

export default function ProfileInfoForm({ profile }: { profile: Employee }) {
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // defaultValues chỉ được đọc 1 lần lúc mount -> trang cha đặt key={profile.id}
    defaultValues: {
      last_name: profile.last_name,
      first_name: profile.first_name,
      phone: profile.phone ?? "",
      gender: toGender(profile.gender),
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await updateProfile(values);
      // Lấy giá trị vừa lưu làm mốc "chưa sửa" mới -> isDirty = false -> nút Lưu tắt lại.
      // Gọi reset trong hàm xử lý sự kiện là đúng, KHÔNG phải kiểu useEffect + setState.
      reset(values);
      toast.success("Đã lưu thông tin");
    } catch {
      // store đã báo lỗi, giữ nguyên nội dung người dùng vừa gõ
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-b border-line"
      noValidate
    >
      <div className="px-5 pt-4">
        <h2 className="text-[14px] font-semibold text-ink">Thông tin cá nhân</h2>
        <p className="text-[12px] text-ink-muted mt-0.5">
          Email, vị trí và lương do quản lý cập nhật.
        </p>
      </div>

      <div className="px-5 pt-3.5 pb-4 grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field
          label="Họ và tên đệm"
          error={errors.last_name?.message}
        >
          <input
            {...register("last_name")}
            autoComplete="family-name"
            className={`${INPUT} ${errors.last_name ? "border-[#B4321F]" : "border-line"}`}
          />
        </Field>

        <Field
          label="Tên"
          error={errors.first_name?.message}
        >
          <input
            {...register("first_name")}
            autoComplete="given-name"
            className={`${INPUT} ${errors.first_name ? "border-[#B4321F]" : "border-line"}`}
          />
        </Field>

        <Field
          label="Số điện thoại"
          error={errors.phone?.message}
        >
          <input
            {...register("phone")}
            inputMode="numeric"
            autoComplete="tel"
            className={`${INPUT} tabular-nums ${errors.phone ? "border-[#B4321F]" : "border-line"}`}
          />
        </Field>

        <Field label="Giới tính">
          {/* Nút tự vẽ không phải input thật -> phải dùng Controller để nối vào form */}
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <div className="flex h-9 border border-line rounded-md overflow-hidden">
                {GENDERS.map((g, i) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={field.value === g}
                    onClick={() => field.onChange(g)}
                    className={`flex-1 text-[12.5px] ${i > 0 ? "border-l border-line" : ""} ${
                      field.value === g
                        ? "bg-navy-700 text-white font-medium"
                        : "bg-white text-ink-secondary hover:bg-row-hover"
                    }`}
                  >
                    {GENDER_LABELS[g]}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>
      </div>

      <div className="px-5 pb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => reset()} // không truyền gì -> về lại defaultValues
          disabled={!isDirty || isSubmitting}
          className="h-8 px-3.5 rounded-md border border-line bg-white text-[12.5px] text-ink hover:bg-row-hover disabled:opacity-45 disabled:cursor-not-allowed"
        >
          Hoàn tác
        </button>
        <button
          type="submit"
          disabled={!isDirty || isSubmitting}
          className="h-8 px-3.5 rounded-md bg-navy-700 text-white text-[12.5px] font-medium hover:bg-navy-hover disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Đang lưu" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

export function Field({
  label,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] text-ink-secondary mb-1.5">{label}</span>
      {children}
      {error ? (
        <span className="block text-[11px] text-[#B4321F] mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-ink-muted mt-1">{hint}</span>
      ) : null}
    </label>
  );
}
