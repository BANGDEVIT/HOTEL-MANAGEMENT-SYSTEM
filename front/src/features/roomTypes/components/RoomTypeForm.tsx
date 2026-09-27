import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import Dropdown from "../../../components/Dropdown";
import type { RoomType, Amenity } from "../../../types/roomType";
import { AMENITY_GROUPS, AMENITY_LABELS } from "../../../types/roomType";
import { BED_TYPE_LABELS } from "../../../types/room";
import type { BedType } from "../../../types/room";
import { useRoomTypeStore } from "../store/roomTypeStore";

const schema = z.object({
  name: z.string().min(1, "Nhập tên loại phòng"),
  base_price: z.coerce
    .number()
    .min(1, "Giá phải lớn hơn 0")
    .max(100_000_000, "Giá không vượt quá 100 triệu"),
  capacity: z.coerce
    .number()
    .int()
    .min(1, "Sức chứa tối thiểu 1 khách")
    .max(20, "Tối đa 20 khách"),
  bed_type: z.enum(["single", "double", "twin", "king", "queen"]),
});

interface Props {
  open: boolean;
  onClose: () => void;
  roomType?: RoomType | null;
}

/** Lớp ngoài chỉ quyết định có dựng form hay không.
 *  key buộc React tạo component mới khi đổi sang loại phòng khác,
 *  nhờ đó state bên trong tự khởi tạo lại — không cần useEffect đồng bộ. */
export default function RoomTypeForm({ open, onClose, roomType }: Props) {
  if (!open) return null;

  return (
    <FormBody
      key={roomType?.id ?? "new"}
      onClose={onClose}
      roomType={roomType}
    />
  );
}

function FormBody({
  onClose,
  roomType,
}: {
  onClose: () => void;
  roomType?: RoomType | null;
}) {
  const { createRoomType, updateRoomType } = useRoomTypeStore();
  const isEdit = !!roomType;

  // Khởi tạo thẳng từ props — không cần effect đồng bộ về sau
  const [amenities, setAmenities] = useState<Amenity[]>(roomType?.amenities ?? []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          name: roomType!.name,
          base_price: roomType!.base_price,
          capacity: roomType!.capacity,
          bed_type: roomType!.bed_type,
        }
      : { name: "", base_price: "", capacity: 2, bed_type: "double" },
  });

  const toggle = (a: Amenity) =>
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );

  const onSubmit = async (values: any) => {
    const payload = { ...values, amenities };
    console.log("payload gửi lên:", payload);
    try {
      if (isEdit && roomType) {
        await updateRoomType(roomType.id, payload);
        toast.success(`Đã cập nhật ${roomType.name}`);
      } else {
        await createRoomType(payload);
        toast.success(`Đã tạo loại phòng ${values.name}`);
      }
      onClose();
    } catch {
      // store đã báo lỗi, giữ form mở
    }
  };

  const bedOptions = (Object.keys(BED_TYPE_LABELS) as BedType[]).map((b) => ({
    value: b,
    label: BED_TYPE_LABELS[b],
  }));

  return (
    <div
      className="fixed inset-0 bg-[#14181D]/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[10px] w-[520px] max-w-full max-h-[86vh] flex flex-col shadow-[0_8px_24px_rgba(20,24,29,.12)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <h2 className="text-[14px] font-semibold text-ink">
            {isEdit ? `Sửa ${roomType!.name}` : "Thêm loại phòng"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-ink-muted hover:bg-row-hover"
          >
            <X
              size={15}
              strokeWidth={1.75}
            />
          </button>
        </div>

        <form
          id="room-type-form"
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <Field
            label="Tên loại phòng"
            error={errors.name?.message as string}
          >
            <input
              {...register("name")}
              autoFocus
              placeholder="Deluxe"
              className="w-full h-9 px-3 border border-line rounded-md text-[13px] outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#1B3A5C]/10"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Giá mỗi đêm"
              error={errors.base_price?.message as string}
            >
              <input
                type="number"
                {...register("base_price")}
                placeholder="500000"
                className="w-full h-9 px-3 border border-line rounded-md text-[13px] tabular-nums outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#1B3A5C]/10"
              />
            </Field>

            <Field
              label="Sức chứa"
              error={errors.capacity?.message as string}
            >
              <input
                type="number"
                min={1}
                {...register("capacity")}
                className="w-full h-9 px-3 border border-line rounded-md text-[13px] tabular-nums outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#1B3A5C]/10"
              />
            </Field>
          </div>

          <Field
            label="Loại giường"
            error={errors.bed_type?.message as string}
          >
            <Controller
              name="bed_type"
              control={control}
              render={({ field }) => (
                <Dropdown
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={bedOptions}
                  placeholder="Chọn loại giường"
                  className="[&>button]:h-9 [&>button]:text-[13px]"
                />
              )}
            />
          </Field>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-[12px] font-medium text-ink">Tiện nghi</label>
              <span className="text-[11px] text-ink-muted tabular-nums">
                đã chọn {amenities.length}
              </span>
            </div>

            <div className="space-y-3">
              {AMENITY_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] text-ink-muted mb-1.5">{group.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((a) => {
                      const on = amenities.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggle(a)}
                          className={`h-7 pl-2 pr-2.5 rounded-md border text-[12px] flex items-center gap-1.5 transition-colors
                            ${
                              on
                                ? "bg-navy-700 border-navy-700 text-white"
                                : "bg-white border-line text-ink-secondary hover:border-line-input"
                            }`}
                        >
                          <span className="w-3 flex justify-center">
                            {on && (
                              <Check
                                size={12}
                                strokeWidth={2.5}
                              />
                            )}
                          </span>
                          {AMENITY_LABELS[a]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-line shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-line text-[13px] text-ink hover:bg-row-hover"
          >
            Huỷ
          </button>
          <button
            type="submit"
            form="room-type-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-md bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-hover disabled:opacity-60"
          >
            {isSubmitting ? "Đang lưu" : isEdit ? "Lưu thay đổi" : "Tạo loại phòng"}
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
      <label className="block text-[12px] font-medium text-ink mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-[#B4321F] mt-1">{error}</p>}
    </div>
  );
}
