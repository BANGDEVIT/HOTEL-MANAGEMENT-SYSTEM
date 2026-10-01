import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";
import { BedDouble, Check, Info } from "lucide-react";
import { roomTypeApi } from "../../../api/roomTypeApi";
import { errorMessage } from "../../../utils/errorMessage";
import {
  AMENITIES,
  AMENITY_LABELS,
  BED_TYPE_SHORT,
  BED_TYPES,
  type Amenity,
  type BedType,
  type RoomTypeInput,
  type RoomTypeItem,
} from "../../../types/roomType";
import { formatAmount, formatMoney, parseDigits } from "../utils/roomTypeMeta";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT } from "../../booking/components/styles";
import { DialogShell, Field, Stepper } from "../../booking/components/ui";

export type RoomTypeFormTarget =
  | { mode: "create" }
  | { mode: "edit"; roomType: RoomTypeItem };

interface Props {
  target: RoomTypeFormTarget | null;
  onClose: () => void;
  onSaved: (roomType: RoomTypeItem) => void;
}

const MAX_CAPACITY = 20;
const DESC_MAX = 1000;

/* ============================ Kiểm tra dữ liệu (giống BE) ============================ */

const schema = z.object({
  name: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Nhập tên loại phòng").max(50, "Tối đa 50 ký tự")),
  // Ô tiền / diện tích cho gõ "1.250.000" -> lưu chuỗi, lúc gửi mới đổi sang số
  base_price: z
    .string()
    .refine((v) => !Number.isNaN(parseDigits(v)), "Nhập giá 1 đêm")
    .refine((v) => parseDigits(v) <= 1_000_000_000, "Giá quá lớn"),
  capacity: z.number().int().min(1).max(MAX_CAPACITY),
  bed_type: z.enum(["single", "double", "twin", "queen", "king"], {
    message: "Chọn loại giường",
  }),
  area: z
    .string()
    .refine(
      (v) => v.trim() === "" || (parseDigits(v) >= 5 && parseDigits(v) <= 1000),
      "Diện tích từ 5 đến 1000 m²",
    ),
  amenities: z.array(z.string()),
  description: z.string().max(DESC_MAX, `Tối đa ${DESC_MAX} ký tự`),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/* ============================ Vỏ hộp thoại ============================ */

/** Vỏ chỉ lo đóng / mở. Thân gắn key -> mỗi lần mở là form MỚI, không sót dữ liệu lần trước */
export default function RoomTypeFormDialog({ target, onClose, onSaved }: Props) {
  if (!target) return null;
  return (
    <FormBody
      key={target.mode === "edit" ? target.roomType.id : "create"}
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
}: Props & { target: RoomTypeFormTarget }) {
  const editing = target.mode === "edit" ? target.roomType : null;
  // Sức chứa nhỏ nhất BE cho phép: không nhỏ hơn số khách của các đặt phòng sắp tới
  const minCap = editing ? Math.max(1, editing.max_upcoming_guests) : 1;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editing?.name ?? "",
      base_price: editing ? formatAmount(editing.base_price) : "",
      capacity: editing?.capacity ?? 2,
      bed_type: editing?.bed_type ?? ("" as BedType),
      area: editing?.area ? String(editing.area) : "",
      amenities: editing?.amenities ?? ["wifi", "air_conditioning", "tv"],
      description: editing?.description ?? "",
    },
  });

  // useWatch (không dùng watch()): chỉ render lại khi đúng các ô này đổi
  const [priceText, description, amenities] = useWatch({
    control,
    name: ["base_price", "description", "amenities"],
  });
  const price = parseDigits(priceText ?? "");
  const priceChanged =
    !!editing && !Number.isNaN(price) && price !== editing.base_price;

  const save = async (v: FormOutput) => {
    const body: RoomTypeInput = {
      name: v.name,
      base_price: parseDigits(v.base_price),
      capacity: v.capacity,
      bed_type: v.bed_type,
      amenities: v.amenities as Amenity[],
      area: v.area.trim() ? parseDigits(v.area) : null,
      description: v.description.trim() || null,
    };
    try {
      // Sửa: sức chứa không đổi thì không gửi -> BE không kiểm tra lại với đặt phòng sắp tới
      const { capacity, ...rest } = body;
      const saved = editing
        ? await roomTypeApi.update(
            editing.id,
            capacity === editing.capacity ? rest : body,
          )
        : await roomTypeApi.create(body);
      toast.success(
        editing
          ? `Đã lưu loại phòng "${saved.name}"`
          : `Đã thêm loại phòng "${saved.name}"`,
      );
      onSaved(saved);
    } catch (err) {
      // Trùng tên: báo ngay dưới ô tên; sức chứa thấp hơn booking sắp tới: báo dưới ô sức chứa
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError("name", {
          message: errorMessage(err, "Tên loại phòng đã tồn tại"),
        });
        return;
      }
      const msg = errorMessage(err, "Không lưu được loại phòng");
      if (msg.includes("sức chứa")) {
        setError("capacity", { message: msg });
        return;
      }
      toast.error(msg);
    }
  };

  return (
    <DialogShell
      title={editing ? `Sửa loại phòng · ${editing.name}` : "Thêm loại phòng"}
      subtitle={
        editing
          ? `${editing.rooms.total} phòng · ${editing.upcoming_bookings} đặt phòng sắp tới`
          : "Loại mới chưa có phòng. Thêm phòng ở trang Phòng sau khi tạo"
      }
      width={640}
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
            {isSubmitting
              ? "Đang lưu"
              : editing
                ? "Lưu thay đổi"
                : "Thêm loại phòng"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-6 py-5">
        <Field
          label="Tên loại phòng"
          required
          error={errors.name?.message}
          className="col-span-2"
        >
          <input
            {...register("name")}
            autoFocus
            placeholder="VD: Deluxe Garden"
            maxLength={50}
            className={INPUT}
          />
        </Field>

        <Field
          label="Giá 1 đêm"
          required
          error={errors.base_price?.message}
          hint={
            priceChanged ? (
              <span className="text-[#6E5616]">
                Giá cũ {formatMoney(editing!.base_price)}.
                {editing!.upcoming_bookings > 0 &&
                  ` ${editing!.upcoming_bookings} đặt phòng sắp tới vẫn giữ giá cũ.`}
              </span>
            ) : (
              "Chỉ áp dụng cho đặt phòng tạo sau khi lưu"
            )
          }
        >
          <Controller
            control={control}
            name="base_price"
            render={({ field }) => (
              <div className="relative">
                <input
                  value={field.value}
                  onChange={(e) => {
                    const n = parseDigits(e.target.value);
                    field.onChange(Number.isNaN(n) ? "" : formatAmount(n));
                  }}
                  onBlur={field.onBlur}
                  inputMode="numeric"
                  placeholder="VD: 800.000"
                  className={`${INPUT} pr-8 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-ink-faint">
                  đ
                </span>
              </div>
            )}
          />
        </Field>

        <Field
          label="Sức chứa"
          required
          error={errors.capacity?.message}
          hint={
            minCap > 1
              ? `Tối thiểu ${minCap}: có đặt phòng sắp tới cần. Không tính trẻ dưới 6 tuổi`
              : "Người lớn + trẻ từ 6 tuổi"
          }
        >
          <Controller
            control={control}
            name="capacity"
            render={({ field }) => (
              <Stepper
                value={field.value}
                min={minCap}
                max={MAX_CAPACITY}
                onChange={field.onChange}
                label="sức chứa"
              />
            )}
          />
        </Field>

        <Field
          label="Loại giường"
          required
          error={errors.bed_type?.message}
          className="col-span-2"
        >
          <Controller
            control={control}
            name="bed_type"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label="Loại giường"
                className="grid grid-cols-5 gap-1.5"
              >
                {BED_TYPES.map((b) => {
                  const on = field.value === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => field.onChange(b)}
                      className={`flex h-[54px] flex-col items-center justify-center gap-1 rounded-[10px] border text-[12px] ${
                        on
                          ? "border-navy-700 bg-cream-50 font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
                          : "border-line-input bg-white text-ink-muted hover:border-navy-700"
                      }`}
                    >
                      <BedDouble
                        size={16}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {BED_TYPE_SHORT[b]}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </Field>

        <Field
          label="Diện tích"
          error={errors.area?.message}
          hint="Hiện trên trang đặt phòng của khách"
        >
          <div className="relative">
            <input
              {...register("area")}
              inputMode="numeric"
              placeholder="VD: 28"
              maxLength={4}
              className={`${INPUT} pr-10 tabular-nums`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-ink-faint">
              m²
            </span>
          </div>
        </Field>
        <div />

        <Field
          label={`Tiện nghi · ${amenities?.length ?? 0} đã chọn`}
          className="col-span-2"
        >
          <Controller
            control={control}
            name="amenities"
            render={({ field }) => {
              const value = field.value as Amenity[];
              const toggle = (a: Amenity) =>
                field.onChange(
                  value.includes(a) ? value.filter((x) => x !== a) : [...value, a],
                );
              return (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {AMENITIES.map((a) => {
                    const on = value.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(a)}
                        className={`flex h-9 items-center gap-2 rounded-[9px] border px-2.5 text-left text-[12.5px] ${
                          on
                            ? "border-navy-700 bg-cream-50 font-medium text-ink"
                            : "border-line-input bg-white text-ink hover:border-navy-700"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                            on
                              ? "border-navy-700 bg-navy-700 text-white"
                              : "border-line-input"
                          }`}
                          aria-hidden="true"
                        >
                          {on && (
                            <Check
                              size={11}
                              strokeWidth={3.5}
                            />
                          )}
                        </span>
                        <span className="truncate">{AMENITY_LABELS[a]}</span>
                      </button>
                    );
                  })}
                </div>
              );
            }}
          />
        </Field>

        <Field
          label="Mô tả"
          error={errors.description?.message}
          className="col-span-2"
        >
          <textarea
            {...register("description")}
            rows={3}
            maxLength={DESC_MAX}
            placeholder="VD: Cửa sổ lớn nhìn ra thành phố, két sắt riêng, góc làm việc thoải mái."
            className={`${INPUT} h-auto resize-none py-2.5 leading-relaxed`}
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-ink-faint">
            {(description ?? "").length}/{DESC_MAX}
          </p>
        </Field>

        {editing && !editing.is_active && (
          <p className="col-span-2 flex items-start gap-2 rounded-[10px] bg-cream-50 px-3.5 py-2.5 text-[12.5px] text-ink-muted">
            <Info
              size={14}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            Loại này đang ngừng kinh doanh. Lưu thay đổi không tự mở bán lại, dùng
            "Mở bán lại" trong menu ⋯.
          </p>
        )}
      </div>
    </DialogShell>
  );
}
