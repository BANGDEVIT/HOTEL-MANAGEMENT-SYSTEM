import { useEffect, useState } from "react";
import { CalendarSearch, Plus } from "lucide-react";
import { useRoomStore } from "./stores/room.store";
import RoomTally from "./components/RoomTally";
import RoomToolbar from "./components/RoomToolbar";
import RoomRack from "./components/RoomRack";
import RoomForm from "./components/RoomForm";
import AvailabilityDialog from "./components/AvailabilityDialog";
import RoomImageDialog from "./components/RoomImageDialog";
import type { Room } from "../../types/room";

export default function RoomManagement() {
  const {
    rooms,
    total,
    filters,
    totalPages,
    lastUpdated,
    loading,
    stats,
    fetchStats,
    setFilters,
    fetchRooms,
  } = useRoomStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Room | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [imageRoomId, setImageRoomId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
    fetchStats();
  }, [fetchRooms, fetchStats]); // action Zustand không đổi tham chiếu -> vẫn chỉ chạy 1 lần

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditTarget(room);
    setFormOpen(true);
  };

  // Chưa có dữ liệu lần nào
  const firstLoad = loading && rooms.length === 0;

  // Đang lọc -> "2 trên 7 phòng". Không lọc -> "7 phòng".
  // stats.total là tổng cả khách sạn, total là số phòng khớp bộ lọc.
  const countText = firstLoad
    ? "Đang tải danh sách phòng"
    : stats && total !== stats.total
      ? `${total} trên ${stats.total} phòng`
      : `${stats?.total ?? total} phòng`;

  const timeText = lastUpdated
    ? `, cập nhật ${lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
    : "";

  return (
    // Thẻ ngoài KHÔNG có khung: chỉ để chứa card + các dialog
    <div>
      {/* Chỉ 1 khung duy nhất */}
      <div className="bg-white border border-[#E4E6E9] rounded-[10px] overflow-hidden">
        <div className="px-5 py-4 flex items-start justify-between border-b border-[#E4E6E9]">
          <div>
            <h1 className="text-[19px] font-semibold text-[#14181D] tracking-[-0.01em]">
              Phòng
            </h1>
            <p className="text-[12px] text-[#98A1AC] mt-0.5 tabular-nums">
              {countText}
              {timeText}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAvailabilityOpen(true)}
              className="h-[34px] px-3.5 rounded-md border border-[#E4E6E9] text-[13px] text-[#14181D] hover:bg-[#F5F6F7] flex items-center gap-2"
            >
              <CalendarSearch
                size={14}
                strokeWidth={1.75}
                className="text-[#5C6672]"
              />
              Phòng trống theo ngày
            </button>
            <button
              onClick={openCreate}
              className="h-[34px] px-3.5 rounded-md bg-[#1B3A5C] text-white text-[13px] font-medium hover:bg-[#0F2440] flex items-center gap-1.5"
            >
              <Plus
                size={14}
                strokeWidth={2}
              />
              Thêm phòng
            </button>
          </div>
        </div>

        <RoomTally />
        <RoomToolbar />
        {/* RoomRack tự có LoadingBar + làm mờ bên trong, ở đây không đặt thêm */}
        <RoomRack
          onEdit={openEdit}
          onCreate={openCreate}
          onManageImages={(room) => setImageRoomId(room.id)}
        />

        {totalPages > 1 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-[#E4E6E9]">
            <span className="text-[12px] text-[#98A1AC] tabular-nums">
              Trang {filters.page} trên {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
                className="h-7 px-3 rounded-md border border-[#E4E6E9] text-[12px] text-[#14181D] hover:bg-[#F5F6F7] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ page: filters.page + 1 })}
                className="h-7 px-3 rounded-md border border-[#E4E6E9] text-[12px] text-[#14181D] hover:bg-[#F5F6F7] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <RoomForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        room={editTarget}
      />
      <RoomImageDialog
        roomId={imageRoomId}
        onClose={() => setImageRoomId(null)}
      />
      <AvailabilityDialog
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
      />
    </div>
  );
}
