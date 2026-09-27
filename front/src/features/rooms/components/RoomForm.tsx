import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Room } from "../../../types/room";
import { useRoomStore } from "../stores/room.store";
import { roomTypeApi } from "../../../api/roomTypeApi";
import type { RoomType } from "@/types/roomType";
import Dropdown from "@/components/Dropdown";

const createSchema = z.object({
  room_number: z.string().min(1, "Nhập số phòng"),
  room_type_id: z.string().uuid("Chọn loại phòng"),
  floor: z.coerce.number().int().min(1, "Tầng phải từ 1 trở lên"),
});

// BE dùng OmitType bỏ room_number khỏi UpdateRoomDto — form sửa không cho đổi số phòng
const editSchema = z.object({
  room_type_id: z.string().uuid("Chọn loại phòng"),
  floor: z.coerce.number().int().min(1, "Tầng phải từ 1 trở lên"),
});

interface Props {
  open: boolean;
  onClose: () => void;
  room?: Room | null;
}

export default function RoomForm({ open, onClose, room }: Props) {
  const { createRoom, updateRoom } = useRoomStore();
  const isEdit = !!room;
  type RoomTypeOption = Pick<RoomType, "id" | "name" | "base_price" | "capacity">;

  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);

  useEffect(() => {
    if (!open) return;
    roomTypeApi
      .getAll({ page: 1, limit: 100 })
      .then((res) =>
        setRoomTypes(
          res.data.map((rt) => ({
            id: rt.id,
            name: rt.name,
            base_price: rt.base_price,
            capacity: rt.capacity,
          })),
        ),
      )
      .catch(() => toast.error("Không tải được danh sách loại phòng"));
  }, [open]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
  });

  // Nạp lại giá trị mỗi khi mở form (quan trọng: khi chuyển từ sửa phòng A sang phòng B)
  useEffect(() => {
    if (!open) return;
    reset(
      isEdit
        ? { room_type_id: room!.room_type.id, floor: room!.floor }
        : { room_number: "", room_type_id: "", floor: 1 },
    );
  }, [open, room?.id]);

  const onSubmit = async (values: any) => {
    try {
      if (isEdit && room) {
        await updateRoom(room.id, values);
        toast.success(`Đã cập nhật phòng ${room.room_number}`);
      } else {
        await createRoom(values);
        toast.success(`Đã tạo phòng ${values.room_number}`);
      }
      onClose();
    } catch {
      // store đã báo lỗi rồi — ở đây chỉ cần giữ form mở
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[#14181D]/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[10px] w-[420px] max-w-full shadow-[0_8px_24px_rgba(20,24,29,.12)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="text-[14px] font-semibold text-ink">
            {isEdit ? `Sửa phòng ${room!.room_number}` : "Thêm phòng"}
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
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 space-y-4"
        >
          {!isEdit && (
            <Field
              label="Số phòng"
              error={errors.room_number?.message as string}
            >
              <input
                {...register("room_number")}
                placeholder="101"
                autoFocus
                className="w-full h-9 px-3 border border-line rounded-md text-[13px] outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#1B3A5C]/10"
              />
            </Field>
          )}

          <Field
            label="Loại phòng"
            error={errors.room_type_id?.message as string}
          >
            <Controller
              name="room_type_id"
              control={control}
              render={({ field }) => (
                <Dropdown
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Chọn loại phòng"
                  className="[&>button]:h-9 [&>button]:text-[13px]"
                  options={roomTypes.map((rt) => ({
                    value: rt.id,
                    label: rt.name,
                    hint: `${rt.base_price.toLocaleString("vi-VN")}đ · ${rt.capacity} khách`,
                  }))}
                />
              )}
            />
          </Field>

          <Field
            label="Tầng"
            error={errors.floor?.message as string}
          >
            <input
              type="number"
              min={1}
              {...register("floor")}
              className="w-full h-9 px-3 border border-line rounded-md text-[13px] outline-none focus:border-navy-700 focus:ring-2 focus:ring-[#1B3A5C]/10"
            />
          </Field>

          <div className="flex gap-2 justify-end pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-md border border-line text-[13px] text-ink hover:bg-row-hover"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 rounded-md bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-hover disabled:opacity-60"
            >
              {isSubmitting ? "Đang lưu" : isEdit ? "Lưu thay đổi" : "Tạo phòng"}
            </button>
          </div>
        </form>
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
