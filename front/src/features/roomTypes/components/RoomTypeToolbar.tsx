import { useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { DEFAULT_FILTERS, useRoomTypeStore } from "../store/roomTypeStore";
import {
  ROOM_TYPE_SORT_OPTIONS,
  ROOM_TYPE_STATUS_TABS,
  type RoomTypeSort,
} from "../../../types/roomType";
import { SelectChip } from "../../booking/components/ui";

/**
 * Tìm tên + tab trạng thái + sắp xếp. Lọc ngay trên FE nên gõ tới đâu lọc tới đó,
 * không cần debounce như các màn gọi API.
 */
export default function RoomTypeToolbar({ shown }: { shown: number }) {
  const filters = useRoomTypeStore((s) => s.filters);
  const items = useRoomTypeStore((s) => s.items);
  const setFilters = useRoomTypeStore((s) => s.setFilters);
  const resetFilters = useRoomTypeStore((s) => s.resetFilters);
  const inputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const active = items.filter((t) => t.is_active).length;
    return { all: items.length, active, inactive: items.length - active };
  }, [items]);

  // Phím "/" nhảy vào ô tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || el.closest("input, textarea, select, [contenteditable]"))
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isFiltered =
    filters.search !== "" ||
    filters.status !== DEFAULT_FILTERS.status ||
    filters.sort !== DEFAULT_FILTERS.sort;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-3">
      <label className="relative min-w-[240px] flex-1">
        <span className="sr-only">Tìm loại phòng</span>
        <Search
          size={15}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Tìm tên loại phòng"
          className="h-10 w-full rounded-[10px] border border-line-input bg-cream-50 pl-9 pr-10 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-navy-700 focus:bg-white focus:outline-none focus:ring-3 focus:ring-gold-500/30"
        />
        {filters.search ? (
          <button
            type="button"
            aria-label="Xoá từ khoá"
            onClick={() => setFilters({ search: "" })}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint hover:bg-segment hover:text-ink"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 text-[10.5px] text-ink-faint">
            /
          </kbd>
        )}
      </label>

      <div
        role="tablist"
        aria-label="Trạng thái kinh doanh"
        className="flex rounded-[10px] bg-segment p-[3px]"
      >
        {ROOM_TYPE_STATUS_TABS.map((t) => {
          const on = filters.status === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilters({ status: t.value })}
              className={`h-[32px] whitespace-nowrap rounded-[8px] px-3 text-[13px] transition-colors ${
                on
                  ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 font-normal tabular-nums ${on ? "text-gold-700" : "text-ink-faint"}`}
              >
                {counts[t.value]}
              </span>
            </button>
          );
        })}
      </div>

      <SelectChip
        label="Sắp xếp"
        value={filters.sort}
        onChange={(v) => setFilters({ sort: v as RoomTypeSort })}
        options={ROOM_TYPE_SORT_OPTIONS}
      />

      {isFiltered && (
        <button
          type="button"
          onClick={resetFilters}
          className="whitespace-nowrap px-1 text-[12.5px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Xoá lọc
        </button>
      )}
      {isFiltered && (
        <span className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-faint">
          {shown} kết quả
        </span>
      )}
    </div>
  );
}
