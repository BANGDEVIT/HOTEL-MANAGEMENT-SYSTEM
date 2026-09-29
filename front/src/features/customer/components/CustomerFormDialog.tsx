import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, ShieldAlert, X } from "lucide-react";
import { customerApi } from "../../../api/customerApi";
import { errorMessage } from "../../../utils/errorMessage";
import { useAuthStore } from "../../auth/store/authStore";
import {
  ID_TYPE_LABELS,
  NATIONALITIES,
  type CustomerDetail,
  type CustomerLookup,
  type CustomerUpdateInput,
  type IdType,
} from "../../../types/customer";
import {
  formatDate,
  formatPhone,
  normalizeIdCard,
  normalizePhone,
} from "../utils/format";

export type FormTarget =
  | { mode: "create" }
  | { mode: "edit"; customer: CustomerDetail };

interface Props {
  target: FormTarget | null;
  onClose: () => void;
  onSaved: (customer: CustomerDetail, mode: FormTarget["mode"]) => void;
  /** Bấm "Mở hồ sơ này" trong cảnh báo trùng */
  onOpenExisting: (customerId: string) => void;
}

/* ============================ Kiểm tra dữ liệu ============================ */

const PHONE_REGEX = /^\+?\d{9,15}$/; // giống BE
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const schema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(1, "Nhập số điện thoại")
      .refine(
        (v) => PHONE_REGEX.test(normalizePhone(v)),
        "Số điện thoại không hợp lệ",
      ),
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || EMAIL_REGEX.test(v), "Email không hợp lệ"),
    last_name: z
      .string()
      .trim()
      .min(1, "Nhập họ và tên đệm")
      .max(50, "Tối đa 50 ký tự"),
    first_name: z.string().trim().min(1, "Nhập tên").max(50, "Tối đa 50 ký tự"),
    id_type: z.enum(["", "cccd", "passport"]),
    id_card: z.string(),
    nationality: z.string().trim().max(50, "Tối đa 50 ký tự"),
    reward_points: z.string(),
    is_active: z.boolean(),
  })
  // Kiểm tra liên quan nhiều field: có số giấy tờ thì phải chọn loại, CCCD phải đủ 12 số
  .superRefine((v, ctx) => {
    const card = normalizeIdCard(v.id_card);
    if (card) {
      if (!v.id_type) {
        ctx.addIssue({
          code: "custom",
          path: ["id_type"],
          message: "Chọn loại giấy tờ",
        });
      } else if (v.id_type === "cccd" && !/^\d{12}$/.test(card)) {
        ctx.addIssue({
          code: "custom",
          path: ["id_card"],
          message: "Số CCCD gồm đúng 12 chữ số",
        });
      } else if (!/^[A-Z0-9]{6,12}$/.test(card)) {
        ctx.addIssue({
          code: "custom",
          path: ["id_card"],
          message: "Số giấy tờ gồm 6–12 chữ hoặc số",
        });
      }
    }
    if (v.reward_points !== "" && !/^\d+$/.test(v.reward_points)) {
      ctx.addIssue({
        code: "custom",
        path: ["reward_points"],
        message: "Điểm thưởng là số nguyên không âm",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

/* ============================ Vỏ hộp thoại ============================ */

/**
 * Vỏ ngoài chỉ lo đóng/mở. Phần thân gắn key: mỗi lần mở là 1 form MỚI hoàn toàn,
 * không sót dữ liệu / cảnh báo trùng của lần trước.
 */
export default function CustomerFormDialog({
  target,
  onClose,
  onSaved,
  onOpenExisting,
}: Props) {
  if (!target) return null;
  const key = target.mode === "edit" ? target.customer.id : "create";
  return (
    <FormBody
      key={key}
      target={target}
      onClose={onClose}
      onSaved={onSaved}
      onOpenExisting={onOpenExisting}
    />
  );
}

function FormBody({
  target,
  onClose,
  onSaved,
  onOpenExisting,
}: Props & { target: FormTarget }) {
  const editing = target.mode === "edit" ? target.customer : null;
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isManager = roles.includes("manager") || roles.includes("admin");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: editing?.phone ?? "",
      email: editing?.email ?? "",
      last_name: editing?.last_name ?? "",
      first_name: editing?.first_name ?? "",
      id_type: editing?.id_type ?? "",
      id_card: editing?.id_card ?? "",
      nationality: editing?.nationality ?? "Việt Nam",
      reward_points: editing ? String(editing.reward_points) : "",
      is_active: editing?.account?.is_active ?? true,
    },
  });

  // useWatch thay cho watch(): chỉ component này render lại khi id_type đổi,
  // và tương thích React Compiler
  const idType = useWatch({ control, name: "id_type" });

  /* ----- Ảnh giấy tờ ----- */
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  /* ----- Kiểm tra trùng khi rời ô SĐT / số giấy tờ ----- */
  const [phoneMatches, setPhoneMatches] = useState<CustomerLookup[]>([]);
  const [idMatches, setIdMatches] = useState<CustomerLookup[]>([]);
  const [allowDuplicatePhone, setAllowDuplicatePhone] = useState(false);

  const lookup = async (field: "phone" | "id_card") => {
    const raw = getValues(field);
    const value = field === "phone" ? normalizePhone(raw) : normalizeIdCard(raw);
    const setMatches = field === "phone" ? setPhoneMatches : setIdMatches;

    const valid = field === "phone" ? PHONE_REGEX.test(value) : value.length >= 6;
    // Sửa hồ sơ mà giá trị không đổi -> không cần kiểm tra
    const unchanged =
      editing && value === (field === "phone" ? editing.phone : editing.id_card);
    if (!valid || unchanged) {
      setMatches([]);
      return;
    }

    try {
      const found = await customerApi.lookup({
        [field]: value,
        exclude_id: editing?.id,
      });
      // Trong lúc chờ, người dùng đã sửa ô này -> kết quả đã cũ, bỏ qua
      const now =
        field === "phone"
          ? normalizePhone(getValues(field))
          : normalizeIdCard(getValues(field));
      if (now !== value) return;
      setMatches(found.filter((c) => c.matched_by.includes(field)));
    } catch {
      // Kiểm tra trùng chỉ để gợi ý, lỗi thì bỏ qua: BE vẫn chặn trùng khi lưu
    }
  };

  const phoneBlocked = phoneMatches.length > 0 && !allowDuplicatePhone;
  const idBlocked = idMatches.length > 0;
  const hasNewImages = front !== null || back !== null;

  /* ----- Lưu ----- */
  const onSubmit = async (v: FormValues) => {
    const identity = {
      first_name: v.first_name.trim(),
      last_name: v.last_name.trim(),
      phone: normalizePhone(v.phone),
      email: v.email.trim() || undefined,
      id_type: (v.id_type || undefined) as IdType | undefined,
      id_card: normalizeIdCard(v.id_card) || undefined,
      nationality: v.nationality.trim() || undefined,
    };

    try {
      if (!editing) {
        const created = await customerApi.createGuest(
          { ...identity, allow_duplicate_phone: allowDuplicatePhone || undefined },
          { front, back },
        );
        toast.success(`Đã thêm khách ${created.full_name}`);
        onSaved(created, "create");
        return;
      }

      const payload: CustomerUpdateInput & { allow_duplicate_phone?: boolean } = {
        ...identity,
        allow_duplicate_phone: allowDuplicatePhone || undefined,
      };
      // Chỉ quản lý mới được gửi 2 field này (BE cũng chặn, gửi lên sẽ bị 403)
      if (isManager && v.reward_points !== String(editing.reward_points)) {
        payload.reward_points = Number(v.reward_points);
      }
      if (
        isManager &&
        editing.account &&
        v.is_active !== editing.account.is_active
      ) {
        payload.is_active = v.is_active;
      }

      const updated = await customerApi.update(editing.id, payload, { front, back });
      toast.success("Đã lưu hồ sơ khách");
      onSaved(updated, "edit");
    } catch (err) {
      toast.error(errorMessage(err, "Không lưu được hồ sơ khách"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex max-h-[92vh] w-[620px] max-w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_24px_60px_rgba(20,38,59,.35)]"
      >
        <header className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">
              {editing ? `Sửa hồ sơ ${editing.full_name}` : "Thêm khách"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {editing
                ? "Giấy tờ có thể bổ sung sau, nhưng bắt buộc khi nhận phòng."
                : "Nhập số điện thoại hoặc giấy tờ trước để kiểm tra khách đã có hồ sơ chưa."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-segment"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-4 overflow-y-auto px-6 py-5">
          <Field
            label="Số điện thoại"
            required
            error={errors.phone?.message}
          >
            <input
              {...register("phone", {
                onBlur: () => lookup("phone"),
                onChange: () => setAllowDuplicatePhone(false), // đổi số -> phải xác nhận lại
              })}
              inputMode="tel"
              autoFocus={!editing}
              placeholder="0909 123 456"
              className={INPUT}
            />
          </Field>
          <Field
            label="Email"
            error={errors.email?.message}
          >
            <input
              {...register("email")}
              type="email"
              placeholder="Không bắt buộc"
              className={INPUT}
            />
          </Field>

          {/* ----- Cảnh báo trùng ----- */}
          {phoneMatches.length > 0 && (
            <DuplicateNotice
              tone={allowDuplicatePhone ? "muted" : "warn"}
              title={
                allowDuplicatePhone
                  ? "Sẽ tạo hồ sơ riêng dù trùng số điện thoại"
                  : "Số điện thoại này đã có hồ sơ"
              }
              matches={phoneMatches}
              onOpen={onOpenExisting}
              extra={
                allowDuplicatePhone ? (
                  <button
                    type="button"
                    onClick={() => setAllowDuplicatePhone(false)}
                    className={LINK_BTN}
                  >
                    Hoàn tác
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAllowDuplicatePhone(true)}
                    className={SECONDARY_BTN}
                  >
                    {editing ? "Vẫn lưu số này" : "Vẫn tạo khách mới"}
                  </button>
                )
              }
            />
          )}

          <Field
            label="Họ và tên đệm"
            required
            error={errors.last_name?.message}
          >
            <input
              {...register("last_name")}
              placeholder="Trần Minh"
              className={INPUT}
            />
          </Field>
          <Field
            label="Tên"
            required
            error={errors.first_name?.message}
          >
            <input
              {...register("first_name")}
              placeholder="Khoa"
              className={INPUT}
            />
          </Field>

          <Field
            label="Loại giấy tờ"
            error={errors.id_type?.message}
          >
            <div
              role="radiogroup"
              className="flex h-10 rounded-[10px] bg-segment p-[3px]"
            >
              {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={idType === t}
                  onClick={() =>
                    setValue("id_type", idType === t ? "" : t, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className={`flex-1 rounded-[8px] text-[13px] transition-colors ${
                    idType === t
                      ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]"
                      : "text-ink-muted"
                  }`}
                >
                  {ID_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </Field>
          <Field
            label="Số giấy tờ"
            error={errors.id_card?.message}
          >
            <input
              {...register("id_card", { onBlur: () => lookup("id_card") })}
              placeholder={idType === "passport" ? "VD: C1234567" : "12 chữ số"}
              className={`${INPUT} tabular-nums`}
            />
          </Field>

          {idMatches.length > 0 && (
            <DuplicateNotice
              tone="danger"
              title="Số giấy tờ này đã thuộc một hồ sơ khác"
              description="Mỗi giấy tờ chỉ gắn với một khách. Mở hồ sơ đó hoặc kiểm tra lại số."
              matches={idMatches}
              onOpen={onOpenExisting}
            />
          )}

          <Field
            label="Quốc tịch"
            error={errors.nationality?.message}
            full
          >
            <input
              {...register("nationality")}
              list="nationality-options"
              className={INPUT}
            />
            <datalist id="nationality-options">
              {NATIONALITIES.map((n) => (
                <option
                  key={n}
                  value={n}
                />
              ))}
            </datalist>
          </Field>

          <Field
            label="Ảnh giấy tờ"
            full
          >
            <div className="grid grid-cols-2 gap-3">
              <ImagePicker
                label="Mặt trước"
                file={front}
                existingUrl={editing?.id_card_img_url}
                onChange={setFront}
              />
              <ImagePicker
                label="Mặt sau"
                file={back}
                existingUrl={editing?.id_card_img_back_url}
                onChange={setBack}
              />
            </div>
          </Field>

          {/* ----- Chỉ quản lý thấy ----- */}
          {editing && isManager && (
            <div className="col-span-2 grid grid-cols-2 gap-4 rounded-[12px] border border-line bg-cream-50 p-4">
              <p className="col-span-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                <ShieldAlert
                  size={14}
                  className="text-gold-700"
                />{" "}
                Dành cho quản lý
              </p>
              <Field
                label="Điểm thưởng"
                error={errors.reward_points?.message}
              >
                <input
                  {...register("reward_points")}
                  inputMode="numeric"
                  className={`${INPUT} bg-white tabular-nums`}
                />
              </Field>
              {editing.account && (
                <Field label="Tài khoản thành viên">
                  <label className="flex h-10 cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      {...register("is_active")}
                      className="h-4 w-4 accent-[var(--color-navy-700)]"
                    />
                    Cho phép đăng nhập
                  </label>
                </Field>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-cream-50 px-6 py-3.5">
          {(phoneBlocked || idBlocked) && (
            <span className="mr-auto flex items-center gap-1.5 text-[12px] text-room-occupied">
              <AlertTriangle size={13} /> Xử lý cảnh báo trùng trước khi lưu
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={SECONDARY_BTN}
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              phoneBlocked ||
              idBlocked ||
              (editing !== null && !isDirty && !hasNewImages)
            }
            className="h-10 rounded-[10px] bg-navy-700 px-5 text-[13.5px] font-semibold text-white hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Đang lưu" : editing ? "Lưu thay đổi" : "Lưu khách"}
          </button>
        </footer>
      </form>
    </div>
  );
}

/* ============================ Mảnh nhỏ ============================ */

const INPUT =
  "h-10 w-full rounded-[10px] border border-line-input px-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-navy-700 focus:outline-none focus:ring-3 focus:ring-gold-500/30";
const SECONDARY_BTN =
  "h-9 whitespace-nowrap rounded-[9px] border border-line-input bg-white px-3.5 text-[12.5px] font-medium text-ink hover:border-navy-700 disabled:opacity-50";
const LINK_BTN = "whitespace-nowrap text-[12.5px] text-navy-700 hover:underline";

function Field({
  label,
  required,
  error,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
        {label}
        {required && <span className="ml-0.5 text-room-occupied">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[12px] text-room-occupied">{error}</p>}
    </div>
  );
}

function DuplicateNotice({
  tone,
  title,
  description,
  matches,
  onOpen,
  extra,
}: {
  tone: "warn" | "danger" | "muted";
  title: string;
  description?: string;
  matches: CustomerLookup[];
  onOpen: (id: string) => void;
  extra?: React.ReactNode;
}) {
  const styles = {
    warn: "border-gold-500/50 bg-gold-50",
    danger: "border-room-occupied/40 bg-[#F8E4DF]",
    muted: "border-line bg-cream-50",
  }[tone];

  return (
    <div
      role="alert"
      className={`col-span-2 rounded-[12px] border px-4 py-3 ${styles}`}
    >
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-0.5 text-[12.5px] text-ink-secondary">{description}</p>
      )}
      <ul className="mt-2 grid gap-2">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-[12.5px] text-ink-secondary">
              <b className="font-semibold text-ink">{m.full_name}</b>,{" "}
              {formatPhone(m.phone)}
              {m.stays > 0 ? `, đã ở ${m.stays} lần` : ", chưa ở lần nào"}
              {m.last_stay_at && `, gần nhất ${formatDate(m.last_stay_at)}`}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpen(m.id)}
                className={SECONDARY_BTN}
              >
                Mở hồ sơ này
              </button>
            </span>
          </li>
        ))}
      </ul>
      {extra && <div className="mt-2.5 flex justify-end">{extra}</div>}
    </div>
  );
}

/**
 * Chọn 1 ảnh, có xem trước. URL xem trước tạo bằng URL.createObjectURL
 * phải được thu hồi (revoke) khi đổi ảnh / đóng form, không thì rò bộ nhớ.
 */
function ImagePicker({
  label,
  file,
  existingUrl,
  onChange,
}: {
  label: string;
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
}) {
  // URL xem trước được tạo NGAY TRONG hàm xử lý sự kiện chọn file (không phải trong effect)
  const [preview, setPreview] = useState<string | null>(null);

  // Effect chỉ làm việc "dọn dẹp" với hệ thống bên ngoài, không setState:
  // preview đổi -> thu hồi URL cũ; đóng form -> thu hồi URL cuối cùng
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type))
      return toast.error(`${f.name} không phải ảnh jpeg, png hoặc webp`);
    if (f.size > MAX_IMAGE) return toast.error(`${f.name} lớn hơn 5MB`);
    onChange(f);
    setPreview(URL.createObjectURL(f));
  };

  const shown = preview ?? existingUrl ?? null;

  return (
    <label className="group relative flex h-28 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[12px] border border-dashed border-line-input bg-cream-50 text-[12px] text-ink-muted hover:border-navy-700">
      {shown ? (
        <>
          <img
            src={shown}
            alt={`Ảnh giấy tờ ${label.toLowerCase()}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-[5px] bg-navy-900/70 px-1.5 py-0.5 text-[11px] text-white">
            {label}
            {file ? " (mới)" : ""}
          </span>
          <span className="absolute right-1.5 top-1.5 rounded-[5px] bg-white/90 px-1.5 py-0.5 text-[11px] text-ink opacity-0 group-hover:opacity-100">
            Đổi ảnh
          </span>
        </>
      ) : (
        <>
          <ImagePlus
            size={18}
            strokeWidth={1.6}
          />
          {label}
          <span className="text-[11px] text-ink-faint">
            jpeg, png, webp, dưới 5MB
          </span>
        </>
      )}
      <input
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ""; // chọn lại cùng file vẫn nhận
        }}
      />
    </label>
  );
}
