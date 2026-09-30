import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { serviceApi } from "../../../api/serviceApi";
import { errorMessage } from "../../../utils/errorMessage";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  UNITS,
  UNIT_LABELS,
  type ServiceCategory,
  type ServiceItem,
  type ServiceUnit,
} from "../../../types/service";
import { CATEGORY_META, formatAmount } from "../utils/serviceMeta";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT } from "../../booking/components/styles";
import { DialogShell, Field } from "../../booking/components/ui";

export type ServiceFormTarget =
  | { mode: "create" }
  | { mode: "edit"; service: ServiceItem };

interface Props {
  target: ServiceFormTarget | null;
  onClose: () => void;
  onSaved: (service: ServiceItem, mode: ServiceFormTarget["mode"]) => void;
}

/* ============================ Kiểm tra dữ liệu (giống BE) ============================ */

const digits = (v: string) => v.replace(/\D/g, "");

const schema = z.object({
  name: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Nhập tên dịch vụ").max(100, "Tối đa 100 ký tự")),
  category: z.enum(["food", "laundry", "minibar", "surcharge", "other"], {
    message: "Chọn nhóm dịch vụ",
  }),
  unit: z.enum(["turn", "portion", "kg", "set", "bottle", "can", "hour", "day"], {
    message: "Chọn đơn vị tính",
  }),
  // Ô giá cho gõ "50.000" -> lưu dạng chuỗi, lúc gửi mới đổi sang số
  price: z
    .string()
    .refine((v) => digits(v) !== "", "Nhập đơn giá")
    .refine((v) => Number(digits(v)) <= 100_000_000, "Đơn giá quá lớn"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/* ============================ Vỏ hộp thoại ============================ */

/** Vỏ chỉ lo đóng / mở. Thân gắn key -> mỗi lần mở là form MỚI, không sót dữ liệu lần trước */
export default function ServiceFormDialog({ target, onClose, onSaved }: Props) {
  if (!target) return null;
  return (
    <FormBody
      key={target.mode === "edit" ? target.service.id : "create"}
      target={target}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function FormBody({
  target,
  onClose,
  onSaved,
}: Props & { target: ServiceFormTarget }) {
  const editing = target.mode === "edit" ? target.service : null;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editing?.name ?? "",
      category: editing?.category ?? ("" as ServiceCategory),
      unit: editing?.unit ?? "turn",
      price: editing ? formatAmount(editing.price) : "",
    },
  });

  // useWatch (không dùng watch()): chỉ render lại khi đúng các ô này đổi, tương thích React Compiler
  const [name, category, unit, priceText] = useWatch({
    control,
    name: ["name", "category", "unit", "price"],
  });
  const price = Number(digits(priceText ?? "")) || 0;
  const priceChanged = !!editing && price !== editing.price;

  const save = async (v: FormOutput) => {
    const body = {
      name: v.name,
      category: v.category,
      unit: v.unit,
      price: Number(digits(v.price)),
    };
    try {
      if (!editing) {
        const created = await serviceApi.create(body);
        toast.success(`Đã thêm dịch vụ "${created.name}"`);
        onSaved(created, "create");
        return;
      }
      const updated = await serviceApi.update(editing.id, body);
      toast.success("Đã lưu dịch vụ");
      onSaved(updated, "edit");
    } catch (err) {
      // Trùng tên: báo ngay dưới ô tên thay vì toast, người dùng sửa tại chỗ
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError("name", {
          message: errorMessage(err, "Tên dịch vụ đã tồn tại"),
        });
        return;
      }
      toast.error(errorMessage(err, "Không lưu được dịch vụ"));
    }
  };

  return (
    <DialogShell
      title={editing ? "Sửa dịch vụ" : "Thêm dịch vụ"}
      subtitle={
        editing
          ? `${editing.name} · đã dùng ${editing.total_uses} lần trong hoá đơn`
          : "Dịch vụ mới được bán ngay, lễ tân chọn được khi thêm dịch vụ cho khách"
      }
      width={560}
      busy={isSubmitting}
      onClose={onClose}
      onSubmit={() => void handleSubmit(save)()}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={BTN_SECONDARY}
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (!!editing && !isDirty)}
            className={BTN_PRIMARY}
          >
            {isSubmitting ? "Đang lưu" : editing ? "Lưu thay đổi" : "Thêm dịch vụ"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-6 py-5">
        <Field
          label="Tên dịch vụ"
          required
          error={errors.name?.message}
          className="col-span-2"
        >
          <input
            {...register("name")}
            autoFocus
            placeholder="VD: Giặt ủi"
            maxLength={100}
            className={INPUT}
          />
        </Field>

        <Field
          label="Nhóm"
          required
          error={errors.category?.message}
          className="col-span-2"
        >
          <div
            role="radiogroup"
            aria-label="Nhóm dịch vụ"
            className="flex flex-wrap gap-1.5"
          >
            {CATEGORIES.map((c) => {
              const on = category === c;
              const { icon: Icon, color } = CATEGORY_META[c];
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() =>
                    setValue("category", c, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className={`flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] transition-colors ${
                    on
                      ? "border-navy-700 bg-[#F7F9FC] font-semibold text-navy-700"
                      : "border-line bg-white text-ink-muted hover:border-line-input"
                  }`}
                >
                  <Icon
                    size={14}
                    style={{ color }}
                    aria-hidden="true"
                  />
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Đơn giá (đ)"
          required
          error={errors.price?.message}
        >
          <input
            {...register("price", {
              // Gõ tới đâu thêm dấu chấm tới đó: 50000 -> 50.000
              onChange: (e) => {
                const d = digits(e.target.value).slice(0, 9);
                setValue("price", d ? formatAmount(Number(d)) : "", {
                  shouldDirty: true,
                });
              },
            })}
            inputMode="numeric"
            placeholder="0"
            className={`${INPUT} text-right tabular-nums`}
          />
        </Field>

        <Field
          label="Đơn vị tính"
          required
          error={errors.unit?.message}
        >
          <select
            {...register("unit")}
            className={INPUT}
          >
            {UNITS.map((u) => (
              <option
                key={u}
                value={u}
              >
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </Field>

        {/* Xem trước đúng dòng lễ tân sẽ thấy khi thêm dịch vụ cho khách */}
        <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] border border-dashed border-line-input px-3.5 py-2.5 text-[12.5px]">
          <span className="text-ink-muted">Lễ tân sẽ thấy:</span>
          <b className="font-semibold text-ink">{name?.trim() || "Tên dịch vụ"}</b>
          <span className="tabular-nums text-ink-muted">
            {formatAmount(price)} / {UNIT_LABELS[unit as ServiceUnit] ?? "…"}
          </span>
          <span className="ml-auto tabular-nums text-ink-muted">
            × 2 = <b className="font-semibold text-ink">{formatAmount(price * 2)}</b>
          </span>
        </div>

        {priceChanged && (
          <p className="col-span-2 flex gap-2 rounded-[10px] border border-line-soft bg-cream-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-secondary">
            <Info
              size={14}
              className="mt-0.5 shrink-0"
            />
            <span>
              Giá cũ{" "}
              <b className="font-semibold tabular-nums">
                {formatAmount(editing.price)}
              </b>{" "}
              → mới{" "}
              <b className="font-semibold tabular-nums">{formatAmount(price)}</b>.
              Chỉ áp dụng cho lần dùng sau
              {editing.total_uses > 0 &&
                `; ${editing.total_uses} lần đã dùng trong hoá đơn cũ giữ nguyên giá cũ`}
              .
            </span>
          </p>
        )}
      </div>
    </DialogShell>
  );
}
