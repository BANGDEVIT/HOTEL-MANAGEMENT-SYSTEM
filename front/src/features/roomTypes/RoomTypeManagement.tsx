import { useEffect, useState } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import LoadingBar from "../../components/LoadingBar";
import { useRoomTypeStore } from "./store/roomTypeStore";
import RoomTypeRow, { ROOM_TYPE_GRID } from "./components/RoomTypeRow";
import RoomTypeForm from "./components/RoomTypeForm";
import type { RoomType } from "../../types/roomType";

export default function RoomTypeManagement() {
  const {
    roomTypes,
    total,
    totalPages,
    loading,
    filters,
    setFilters,
    fetchRoomTypes,
    fetchRoomStats,
  } = useRoomTypeStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoomType | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [showHidden, setShowHidden] = useState(false);

  // ── Tải dữ liệu lần đầu ─────────────────────────────
  useEffect(() => {
    fetchRoomTypes();
    fetchRoomStats();
  }, []);

  // ── Tìm kiếm: chờ 350ms sau khi ngừng gõ ────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.search) setFilters({ search: searchInput });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Dữ liệu suy ra ──────────────────────────────────
  const firstLoad = loading && roomTypes.length === 0;
  const active = roomTypes.filter((rt) => rt.is_active !== false);
  const hidden = roomTypes.filter((rt) => rt.is_active === false);

  // ── Hành động ───────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (rt: RoomType) => {
    setEditTarget(rt);
    setFormOpen(true);
  };

  const clearSearch = () => {
    setSearchInput("");
    setFilters({ search: "" });
  };

  return (
    <div>
      {/* Khung chính — không overflow-hidden để popup và menu tràn ra được */}
      <div className="relative bg-white border border-line rounded-[10px]">
        {/* Thanh tải — bọc riêng để bo góc trên khớp viền khung */}
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-[10px] z-10">
          <LoadingBar active={loading} />
        </div>

        {/* ── Tiêu đề ─────────────────────────────────── */}
        <div className="px-5 py-4 flex items-start justify-between border-b border-line">
          <div>
            <h1 className="text-[19px] font-semibold text-ink tracking-[-0.01em]">
              Loại phòng
            </h1>
            <p className="text-[12px] text-ink-muted mt-0.5 tabular-nums">
              {firstLoad ? "Đang tải loại phòng…" : `${active.length} loại đang bán`}
            </p>
          </div>

          <button
            onClick={openCreate}
            className="h-[34px] px-3.5 rounded-md bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-hover flex items-center gap-1.5"
          >
            <Plus
              size={14}
              strokeWidth={2}
            />
            Thêm loại phòng
          </button>
        </div>

        {/* ── Tìm kiếm ────────────────────────────────── */}
        <div className="px-5 py-2.5 border-b border-line flex items-center gap-1.5">
          <div className="flex items-center gap-2 h-7 px-2.5 border border-line rounded-md w-[240px] focus-within:border-navy-700">
            <Search
              size={13}
              strokeWidth={1.75}
              className="text-ink-muted shrink-0"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tên loại phòng"
              className="text-[12px] outline-none w-full text-ink bg-transparent"
            />
          </div>

          {filters.search && (
            <button
              onClick={clearSearch}
              aria-label="Bỏ tìm kiếm"
              className="h-7 w-7 flex items-center justify-center border border-line rounded-md text-ink-muted hover:text-ink hover:bg-row-hover"
            >
              <X
                size={13}
                strokeWidth={1.75}
              />
            </button>
          )}
        </div>

        {/* ── Nội dung ────────────────────────────────── */}
        {firstLoad ? (
          <SkeletonRows />
        ) : roomTypes.length === 0 ? (
          <EmptyState
            searching={!!filters.search}
            onCreate={openCreate}
            onClear={clearSearch}
          />
        ) : (
          <div
            className={`transition-opacity duration-150 ${
              loading ? "opacity-40 pointer-events-none" : "opacity-100"
            }`}
          >
            {/* Hàng tiêu đề cột — dùng chung GRID với RoomTypeRow */}
            <div
              className="grid items-center gap-3.5 h-[38px] px-4 bg-[#FAFBFB] border-b border-line text-[12px] text-ink-muted"
              style={{ gridTemplateColumns: ROOM_TYPE_GRID }}
            >
              <span>Loại phòng</span>
              <span>Phòng</span>
              <span>Tiện nghi</span>
              <span className="text-right">Mỗi đêm</span>
              <span />
            </div>

            {active.map((rt) => (
              <RoomTypeRow
                key={rt.id}
                roomType={rt}
                onEdit={openEdit}
              />
            ))}

            {/* Loại đã ẩn — gom cuối, mặc định thu gọn */}
            {hidden.length > 0 && (
              <>
                <button
                  onClick={() => setShowHidden((s) => !s)}
                  aria-expanded={showHidden}
                  className={`w-full flex items-center justify-between px-4 py-2.5 bg-[#FAFBFB] border-t border-line text-[12px] text-ink-muted hover:text-ink-secondary
                    ${showHidden ? "" : "rounded-b-[10px]"}`}
                >
                  <span className="tabular-nums">
                    Đã ẩn {hidden.length} loại phòng
                  </span>
                  <span className="flex items-center gap-1 text-ink-secondary">
                    {showHidden ? "Thu gọn" : "Hiện"}
                    <ChevronDown
                      size={13}
                      strokeWidth={1.75}
                      className={`transition-transform ${showHidden ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>

                {showHidden &&
                  hidden.map((rt) => (
                    <RoomTypeRow
                      key={rt.id}
                      roomType={rt}
                      onEdit={openEdit}
                    />
                  ))}
              </>
            )}
          </div>
        )}

        {/* ── Phân trang ──────────────────────────────── */}
        {totalPages > 1 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-line">
            <span className="text-[12px] text-ink-muted tabular-nums">
              Trang {filters.page} trên {totalPages}, tổng {total} loại
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
                className="h-7 px-3 rounded-md border border-line text-[12px] text-ink hover:bg-row-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ page: filters.page + 1 })}
                className="h-7 px-3 rounded-md border border-line text-[12px] text-ink hover:bg-row-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <RoomTypeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        roomType={editTarget}
      />
    </div>
  );
}

// ── Khung xám lần tải đầu — đúng chiều cao hàng thật (68px) ──
function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center gap-3.5 min-h-[68px] px-4 border-b border-line-soft last:border-b-0"
          style={{ gridTemplateColumns: ROOM_TYPE_GRID }}
        >
          <div className="space-y-2">
            <div className="w-28 h-3 bg-[#F0F1F3] rounded animate-pulse" />
            <div className="w-36 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="w-20 h-2.5 bg-[#F0F1F3] rounded animate-pulse" />
            <div className="w-full h-1.5 bg-[#F0F1F3] rounded-full animate-pulse" />
          </div>
          <div className="flex gap-1.5">
            <div className="w-14 h-6 bg-[#F0F1F3] rounded-md animate-pulse" />
            <div className="w-16 h-6 bg-[#F0F1F3] rounded-md animate-pulse" />
            <div className="w-12 h-6 bg-[#F0F1F3] rounded-md animate-pulse" />
          </div>
          <div className="ml-auto w-20 h-3.5 bg-[#F0F1F3] rounded animate-pulse" />
          <span />
        </div>
      ))}
    </div>
  );
}

// ── Trạng thái rỗng — phân biệt "chưa có gì" với "tìm không ra" ──
function EmptyState({
  searching,
  onCreate,
  onClear,
}: {
  searching: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <p className="text-[13px] text-ink-secondary mb-3">
        {searching
          ? "Không có loại phòng nào khớp từ khoá."
          : "Chưa có loại phòng nào. Tạo loại phòng trước khi thêm phòng."}
      </p>
      <button
        onClick={searching ? onClear : onCreate}
        className="h-8 px-4 rounded-md border border-line text-[12px] text-ink hover:bg-row-hover"
      >
        {searching ? "Bỏ tìm kiếm" : "Thêm loại phòng"}
      </button>
    </div>
  );
}
