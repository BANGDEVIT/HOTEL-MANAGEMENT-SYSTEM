import { useEffect, useMemo, useState } from "react";
import { CalendarSearch, Plus } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import type { Room } from "../../types/room";
import { useRoomStore } from "./stores/room.store";
import RoomStatsCards from "./components/RoomStatsCards";
import RoomToolbar from "./components/RoomToolbar";
import FloorBar, { type FloorValue } from "./components/FloorBar";
import RoomGrid from "./components/RoomGrid";
import RoomForm from "./components/RoomForm";
import AvailabilityDialog from "./components/AvailabilityDialog";
import RoomImageDialog from "./components/RoomImageDialog";

const time = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

export default function RoomManagement() {
  const rooms = useRoomStore((s) => s.rooms);
  const total = useRoomStore((s) => s.total);
  const stats = useRoomStore((s) => s.stats);
  const loading = useRoomStore((s) => s.loading);
  const lastUpdated = useRoomStore((s) => s.lastUpdated);
  const fetchRooms = useRoomStore((s) => s.fetchRooms);
  const fetchStats = useRoomStore((s) => s.fetchStats);

  const [floor, setFloor] = useState<FloorValue>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Room | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [imageRoomId, setImageRoomId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
    fetchStats();
  }, [fetchRooms, fetchStats]);

  const floors = stats?.floors ?? [];

  // Tầng đang chọn không còn tồn tại (VD: vừa ẩn phòng cuối cùng của tầng đó)
  // -> coi như "Tất cả". TÍNH ra từ dữ liệu, không dùng useEffect + setFloor.
  const activeFloor: FloorValue =
    floor !== "all" && stats && !floors.some((f) => f.floor === floor)
      ? "all"
      : floor;

  // Lọc tầng ngay trên FE: đã tải đủ mọi phòng, bấm đổi tầng không cần gọi API
  const visibleRooms = useMemo(
    () =>
      activeFloor === "all" ? rooms : rooms.filter((r) => r.floor === activeFloor),
    [rooms, activeFloor],
  );

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (room: Room) => {
    setEditTarget(room);
    setFormOpen(true);
  };
  const openImages = (room: Room) => setImageRoomId(room.id);

  const firstLoad = loading && !lastUpdated;

  const subtitle = firstLoad
    ? "Đang tải danh sách phòng"
    : `${stats?.total ?? total} phòng đang hoạt động${lastUpdated ? `, cập nhật lúc ${time(lastUpdated)}` : ""}`;

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header trang ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-gold-700">
            Vận hành
          </p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-tight text-navy-900">
            Phòng
          </h1>
          <p className="mt-1 text-[13px] tabular-nums text-ink-secondary">
            {subtitle}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setAvailabilityOpen(true)}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-line-input bg-white px-4 text-[14px] font-medium text-navy-700 hover:border-navy-700"
          >
            <CalendarSearch
              size={15}
              strokeWidth={1.8}
            />
            Phòng trống theo ngày
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-navy-700 px-4 text-[14px] font-semibold text-white hover:bg-navy-hover"
          >
            <Plus
              size={15}
              strokeWidth={2}
            />
            Thêm phòng
          </button>
        </div>
      </div>

      <RoomStatsCards />

      {/* ===== Card danh sách ===== */}
      <section
        aria-label="Danh sách phòng"
        className="overflow-hidden rounded-[16px] border border-line bg-white"
      >
        <div className="border-b border-line-soft">
          <RoomToolbar />
        </div>

        <FloorBar
          floors={floors}
          selected={activeFloor}
          onSelect={setFloor}
        />

        <div className="relative">
          <LoadingBar active={loading} />

          {firstLoad ? (
            <p className="py-16 text-center text-[13px] text-ink-muted">
              Đang tải danh sách phòng
            </p>
          ) : (
            // Đang tải lại: giữ dữ liệu cũ, làm mờ và chặn bấm cho tới khi có dữ liệu mới
            <div
              className={`transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}
            >
              <RoomGrid
                rooms={visibleRooms}
                onEdit={openEdit}
                onManageImages={openImages}
              />
            </div>
          )}
        </div>
      </section>

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
