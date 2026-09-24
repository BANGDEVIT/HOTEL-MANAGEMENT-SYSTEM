import { useRoomStore } from "../stores/room.store";
import type { Room } from "../../../types/room";
import RoomRow from "./RoomRow";

interface Props {
  onEdit: (room: Room) => void;
  onCreate: () => void;
  onManageImages: (room: Room) => void;
}

export default function RoomRack({ onEdit, onCreate, onManageImages }: Props) {
  const { rooms, loading } = useRoomStore();

  // Lần tải đầu tiên — chưa có gì để hiện, dùng skeleton
  if (loading && rooms.length === 0) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[52px] border-b border-[#F0F1F3] flex items-center px-5 gap-4"
          >
            <div className="w-10 h-3 bg-[#F0F1F3] rounded animate-pulse" />
            <div className="w-24 h-3 bg-[#F0F1F3] rounded animate-pulse" />
            <div className="ml-auto w-16 h-3 bg-[#F0F1F3] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!loading && rooms.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[13px] text-[#5C6672] mb-3">
          Không có phòng nào khớp bộ lọc hiện tại.
        </p>
        <button
          onClick={onCreate}
          className="h-8 px-4 rounded-md border border-[#E4E6E9] text-[12px] text-[#14181D] hover:bg-[#F5F6F7]"
        >
          Thêm phòng
        </button>
      </div>
    );
  }

  const byFloor = rooms.reduce<Record<number, Room[]>>((acc: any, room: any) => {
    (acc[room.floor] ??= []).push(room);
    return acc;
  }, {});

  const floors = Object.keys(byFloor)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="relative">
      {/* Thanh tiến trình chạy ngang — báo có việc đang xử lý */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E4E6E9] overflow-hidden z-10">
          <div className="h-full w-1/3 bg-[#1B3A5C] rounded-full animate-[slide_1s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Danh sách cũ mờ đi và không bấm được trong lúc chờ */}
      <div
        className={`transition-opacity duration-150 ${
          loading ? "opacity-40 pointer-events-none" : "opacity-100"
        }`}
      >
        {floors.map((floor) => {
          const list = byFloor[floor];
          const vacant = list.filter((r: any) => r.status === "available").length;

          return (
            <div key={floor}>
              <div className="flex items-center gap-2.5 px-5 py-2 bg-[#FAFBFB] border-y border-[#E4E6E9]">
                <b className="text-[12px] font-semibold text-[#14181D]">
                  Tầng {floor}
                </b>
                <div className="flex-1 h-px bg-[#E4E6E9]" />
                <span className="text-[11px] text-[#98A1AC] tabular-nums">
                  {list.length} phòng, {vacant} trống
                </span>
              </div>

              {list.map((room: any) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  onEdit={onEdit}
                  onManageImages={onManageImages}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
