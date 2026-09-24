import { useEffect, useState } from "react";
import { Search, ArrowUpDown, X } from "lucide-react";
import { useRoomStore } from "../stores/room.store";
import { roomTypeApi } from "../../../api/roomTypeApi";
import type { RoomStatus } from "../../../types/room";
import { STATUS_LABELS, SORT_OPTIONS } from "../../../types/room";
import Dropdown from "@/components/Dropdown";

const STATUS_CHIPS: { value: RoomStatus | ""; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "available", label: STATUS_LABELS.available },
  { value: "occupied", label: STATUS_LABELS.occupied },
  { value: "cleaning", label: STATUS_LABELS.cleaning },
  { value: "maintenance", label: STATUS_LABELS.maintenance },
  { value: "inactive", label: STATUS_LABELS.inactive },
];

export default function RoomToolbar() {
  const { filters, setFilters, toggleSort } = useRoomStore();
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string }[]>([]);
  const [searchInput, setSearchInput] = useState(filters.search);

  // Danh sách loại phòng chỉ để đổ dropdown — không cần store riêng
  useEffect(() => {
    roomTypeApi
      .getAll({ page: 1, limit: 100 })
      .then((res) =>
        setRoomTypes(res.data.map((rt) => ({ id: rt.id, name: rt.name }))),
      )
      .catch(() => {});
  }, []);

  // Debounce ô tìm kiếm 350ms — tránh gọi API mỗi lần gõ một ký tự
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) setFilters({ search: searchInput });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasFilter =
    filters.search || filters.status || filters.room_type_id || filters.floor;

  const clearAll = () => {
    setSearchInput("");
    setFilters({ search: "", status: "", room_type_id: "", floor: "" });
  };

  return (
    <div className="px-5 py-2.5 flex items-center gap-1.5 border-b border-[#E4E6E9] flex-wrap">
      {STATUS_CHIPS.map((chip) => (
        <button
          key={chip.value}
          onClick={() => setFilters({ status: chip.value })}
          className={`h-7 px-3 rounded-md text-[12px] border transition-colors
            ${
              filters.status === chip.value
                ? "bg-[#14181D] text-white border-[#14181D]"
                : "bg-white text-[#5C6672] border-[#E4E6E9] hover:border-[#CDD2D8]"
            }`}
        >
          {chip.label}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-1.5">
        {/* Sắp xếp — dùng sortBy/order của BE */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown
            size={13}
            strokeWidth={1.75}
            className="text-[#98A1AC]"
          />
          <Dropdown
            value={filters.sortBy}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => toggleSort(v as any)}
            className="w-[112px]"
          />
          <button
            onClick={() => toggleSort(filters.sortBy)}
            title={filters.order === "asc" ? "Tăng dần" : "Giảm dần"}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E4E6E9]
               text-[12px] text-[#5C6672] hover:bg-[#F5F6F7]"
          >
            {filters.order === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <Dropdown
          value={filters.room_type_id}
          options={[
            { value: "", label: "Mọi loại phòng" },
            ...roomTypes.map((rt) => ({ value: rt.id, label: rt.name })),
          ]}
          onChange={(v) => setFilters({ room_type_id: v })}
          className="w-[142px]"
        />

        <input
          type="number"
          min={1}
          placeholder="Tầng"
          value={filters.floor}
          onChange={(e) => setFilters({ floor: e.target.value })}
          className="h-7 w-[68px] px-2.5 border border-[#E4E6E9] rounded-md text-[12px] outline-none"
        />

        <div className="flex items-center gap-2 h-7 px-2.5 border border-[#E4E6E9] rounded-md w-[180px]">
          <Search
            size={13}
            strokeWidth={1.75}
            className="text-[#98A1AC] shrink-0"
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Số phòng"
            className="text-[12px] outline-none w-full text-[#14181D]"
          />
        </div>

        {hasFilter && (
          <button
            onClick={clearAll}
            title="Bỏ lọc"
            className="h-7 w-7 flex items-center justify-center border border-[#E4E6E9] rounded-md text-[#98A1AC] hover:text-[#14181D] hover:bg-[#F5F6F7]"
          >
            <X
              size={13}
              strokeWidth={1.75}
            />
          </button>
        )}
      </div>
    </div>
  );
}
