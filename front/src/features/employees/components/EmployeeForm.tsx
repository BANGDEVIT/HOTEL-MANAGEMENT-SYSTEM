import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import Dropdown from "../../../components/Dropdown";
import type { Employee } from "../../../types/employee";
import { GENDER_LABELS, ROLE_LABELS, primaryRole } from "../../../types/employee";
import { useEmployeeStore } from "../store/employeeStore";

const base = {
  last_name: z.string().min(1, "Nhập họ"),
  first_name: z.string().min(1, "Nhập tên"),
  phone: z.string().regex(/^0\d{9}$/, "Số điện thoại gồm 10 số, bắt đầu bằng 0"),
  position: z.string().min(1, "Nhập vị trí công việc"),
  gender: z.enum(["male", "female", "other"]),
  salary: z.coerce
    .number()
    .min(0, "Lương không được âm")
    .max(1_000_000_000, "Lương quá lớn"),
  hired_date: z.string().min(1, "Chọn ngày vào làm"),
};

const createSchema = z.object({
  ...base,
  email: z.string().email("Email không hợp lệ"),
  password: z
    .string()
    .min(8, "Tối thiểu 8 ký tự")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Cần chữ hoa, chữ thường, số và ký tự đặc biệt",
    ),
  role: z.enum(["manager", "staff"]),
});

const editSchema = z.object(base);

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

export default function EmployeeForm({ open, onClose, employee }: Props) {
  if (!open) return null;
  return (
    <FormBody
      key={employee?.id ?? "new"}
      onClose={onClose}
      employee={employee}
    />
  );
}

function FormBody({
  onClose,
  employee,
}: {
  onClose: () => void;
  employee?: Employee | null;
}) {
  const { createEmployee, updateEmployee } = useEmployeeStore();
  const isEdit = !!employee;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: isEdit
      ? {
          last_name: employee!.last_name,
          first_name: employee!.first_name,
          phone: employee!.phone,
          position: employee!.position,
          gender: employee!.gender,
          salary: employee!.salary,
          hired_date: employee!.hired_date?.slice(0, 10),
        }
      : {
          gender: "male",
          role: "staff",
          salary: "",
          hired_date: new Date().toISOString().slice(0, 10),
        },
  });

  const onSubmit = async (values: any) => {
    try {
      if (isEdit) {
        await updateEmployee(employee!.id, values);
        toast.success(`Đã cập nhật ${values.last_name} ${values.first_name}`);
      } else {
        await createEmployee(values);
        toast.success(
          `Đã tạo tài khoản cho ${values.last_name} ${values.first_name}`,
        );
      }
      onClose();
    } catch {
      // store đã báo lỗi, giữ form mở
    }
  };

  const err = errors as any;
  const input =
    "w-full h-9 px-3 border border-[#E4E6E9] rounded-md text-[13px] outline-none focus:border-[#1B3A5C] focus:ring-2 focus:ring-[#1B3A5C]/10";

  return (
    <div
      className="fixed inset-0 bg-[#14181D]/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[10px] w-[520px] max-w-full max-h-[88vh] flex flex-col shadow-[0_8px_24px_rgba(20,24,29,.12)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E6E9] shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-[#14181D]">
              {isEdit
                ? `Sửa ${employee!.last_name} ${employee!.first_name}`
                : "Thêm nhân viên"}
            </h2>
            {isEdit && (
              <p className="text-[12px] text-[#98A1AC] mt-0.5">
                {employee!.account.email}, {ROLE_LABELS[primaryRole(employee!)]}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="w-7 h-7 flex items-center justify-center rounded text-[#98A1AC] hover:bg-[#F5F6F7]"
          >
            <X
              size={15}
              strokeWidth={1.75}
            />
          </button>
        </div>

        <form
          id="employee-form"
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Họ"
              error={err.last_name?.message}
            >
              <input
                {...register("last_name")}
                autoFocus
                placeholder="Nguyễn"
                className={input}
              />
            </Field>
            <Field
              label="Tên"
              error={err.first_name?.message}
            >
              <input
                {...register("first_name")}
                placeholder="Văn An"
                className={input}
              />
            </Field>
          </div>

          {!isEdit && (
            <>
              <Field
                label="Email đăng nhập"
                error={err.email?.message}
              >
                <input
                  {...register("email")}
                  type="email"
                  placeholder="an.nguyen@hotel.com"
                  className={input}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Mật khẩu ban đầu"
                  error={err.password?.message}
                >
                  <input
                    {...register("password")}
                    type="password"
                    className={input}
                  />
                </Field>
                <Field
                  label="Vai trò"
                  error={err.role?.message}
                >
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: "staff", label: ROLE_LABELS.staff },
                          { value: "manager", label: ROLE_LABELS.manager },
                        ]}
                        className="[&>button]:h-9 [&>button]:text-[13px]"
                      />
                    )}
                  />
                </Field>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Điện thoại"
              error={err.phone?.message}
            >
              <input
                {...register("phone")}
                placeholder="0901234567"
                className={`${input} tabular-nums`}
              />
            </Field>
            <Field
              label="Giới tính"
              error={err.gender?.message}
            >
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    value={field.value}
                    onChange={field.onChange}
                    options={Object.entries(GENDER_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    className="[&>button]:h-9 [&>button]:text-[13px]"
                  />
                )}
              />
            </Field>
          </div>

          <Field
            label="Vị trí công việc"
            error={err.position?.message}
          >
            <input
              {...register("position")}
              placeholder="Lễ tân ca tối"
              className={input}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Lương mỗi tháng"
              error={err.salary?.message}
            >
              <input
                {...register("salary")}
                type="number"
                placeholder="8000000"
                className={`${input} tabular-nums`}
              />
            </Field>
            <Field
              label="Ngày vào làm"
              error={err.hired_date?.message}
            >
              <input
                {...register("hired_date")}
                type="date"
                className={input}
              />
            </Field>
          </div>

          {isEdit && (
            <p className="text-[11px] text-[#98A1AC]">
              Email và vai trò không đổi được ở đây. Đổi mật khẩu dùng mục "Đặt lại
              mật khẩu" trong menu.
            </p>
          )}
        </form>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-[#E4E6E9] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-[#E4E6E9] text-[13px] text-[#14181D] hover:bg-[#F5F6F7]"
          >
            Huỷ
          </button>
          <button
            type="submit"
            form="employee-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-md bg-[#1B3A5C] text-white text-[13px] font-medium hover:bg-[#0F2440] disabled:opacity-60"
          >
            {isSubmitting ? "Đang lưu" : isEdit ? "Lưu thay đổi" : "Tạo nhân viên"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#14181D] mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-[#B4321F] mt-1">{error}</p>}
    </div>
  );
}
