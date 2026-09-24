import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { roomApi } from "../../../api/roomApi";
import type { AvailableRoomResponse } from "../../../types/room";
import { BED_TYPE_LABELS } from "../../../types/room";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Dùng endpoint GET /rooms/available — kiểm tra phòng còn trống trong một khoảng ngày.
 *  Hữu ích khi khách hỏi trực tiếp tại quầy trước lúc tạo booking. */
export default function AvailabilityDialog({ open, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(today);
  const [capacity, setCapacity] = useState("");
  const [result, setResult] = useState<AvailableRoomResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const res = await roomApi.getAvailable({
        check_in_date: checkIn,
        check_out_date: checkOut,
        capacity: capacity ? Number(capacity) : undefined,
      });
      setResult(res);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? "Không kiểm tra được phòng trống");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[#14181D]/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[10px] w-[560px] max-w-full max-h-[80vh] flex flex-col shadow-[0_8px_24px_rgba(20,24,29,.12)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E6E9]">
          <h2 className="text-[14px] font-semibold text-[#14181D]">
            Phòng trống theo ngày
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-[#98A1AC] hover:bg-[#F5F6F7]"
          >
            <X
              size={15}
              strokeWidth={1.75}
            />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-[#E4E6E9] flex items-end gap-2.5">
          <div className="flex-1">
            <label className="block text-[11px] text-[#5C6672] mb-1.5">
              Nhận phòng
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full h-9 px-3 border border-[#E4E6E9] rounded-md text-[13px] outline-none focus:border-[#1B3A5C]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-[#5C6672] mb-1.5">
              Trả phòng
            </label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full h-9 px-3 border border-[#E4E6E9] rounded-md text-[13px] outline-none focus:border-[#1B3A5C]"
            />
          </div>
          <div className="w-[92px]">
            <label className="block text-[11px] text-[#5C6672] mb-1.5">
              Số khách
            </label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Bất kỳ"
              className="w-full h-9 px-3 border border-[#E4E6E9] rounded-md text-[13px] outline-none focus:border-[#1B3A5C]"
            />
          </div>
          <button
            onClick={search}
            disabled={loading}
            className="h-9 px-4 rounded-md bg-[#1B3A5C] text-white text-[13px] font-medium hover:bg-[#0F2440] disabled:opacity-60"
          >
            {loading ? "Đang tìm" : "Tìm"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result ? (
            <p className="py-12 text-center text-[13px] text-[#98A1AC]">
              Chọn khoảng ngày rồi bấm Tìm để xem phòng còn trống.
            </p>
          ) : result.data.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#5C6672]">
              Không còn phòng trống trong khoảng ngày này.
            </p>
          ) : (
            <>
              <div className="px-5 py-2.5 bg-[#FAFBFB] border-b border-[#E4E6E9] text-[12px] text-[#5C6672] tabular-nums">
                {result.total} phòng trống, {result.search_info.nights} đêm
              </div>
              {result.data.map((room) => (
                <div
                  key={room.id}
                  className="grid items-center h-[44px] px-5 border-b border-[#F0F1F3] text-[13px]"
                  style={{ gridTemplateColumns: "64px 1fr 100px 72px 100px" }}
                >
                  <span className="font-semibold text-[#14181D] tabular-nums">
                    {room.room_number}
                  </span>
                  <span className="text-[#14181D]">{room.room_type.name}</span>
                  <span className="text-[12px] text-[#5C6672]">
                    {BED_TYPE_LABELS[room.room_type.bed_type]}
                  </span>
                  <span className="text-[12px] text-[#98A1AC] tabular-nums">
                    Tầng {room.floor}
                  </span>
                  <span className="text-right tabular-nums text-[#14181D]">
                    {room.room_type.base_price.toLocaleString("vi-VN")}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
