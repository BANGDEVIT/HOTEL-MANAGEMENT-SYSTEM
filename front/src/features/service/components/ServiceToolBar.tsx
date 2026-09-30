import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { DEFAULT_FILTERS, useServiceStore } from "../store/serviceStore";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SERVICE_SORT_OPTIONS,
  SERVICE_STATUS_OPTIONS,
  type ServiceCategory,
  type ServiceSort,
  type ServiceStatusFilter,
} from "../../../types/service";
import { SelectChip } from "../../booking/components/ui";

const SEARCH_DELAY_MS = 350;

/**
 * 2 hàng:
 *   1. Ô tìm kiếm + tab nhóm dịch vụ (kèm số lượng)
 *   2. Trạng thái, sắp xếp, xoá lọc, số kết quả
 */
export default function ServiceToolbar() {
  const filters = useServiceStore((s) => s.filters);
  const stats = useServiceStore((s) => s.stats);
  const total = useServiceStore((s) => s.total);
  const shown = useServiceStore((s) => s.services.length);
  const setFilters = useServiceStore((s) => s.setFilters);
  const resetFilters = useServiceStore((s) => s.resetFilters);

  /* ----- Tìm kiếm: gõ xong 350ms mới gọi API ----- */
  const [text, setText] = useState(filters.search);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (text.trim() === filters.search.trim()) return;
    const timer = setTimeout(() => setFilters({ search: text }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, filters.search, setFilters]);

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
    filters.search.trim() !== "" ||
    filters.category !== "" ||
    filters.status !== DEFAULT_FILTERS.status ||
    filters.sort !== DEFAULT_FILTERS.sort ||
    filters.order !== DEFAULT_FILTERS.order;

  const clearAll = () => {
    setText("");
    resetFilters();
  };

  const tabs: { value: ServiceCategory | ""; label: string; count?: number }[] = [
    { value: "", label: "Tất cả", count: stats?.total },
    ...CATEGORIES.map((c) => ({
      value: c,
      label: CATEGORY_LABELS[c],
      count: stats?.by_category[c],
    })),
  ];

  return (
    <div>
      {/* ===== Hàng 1 ===== */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-[18px] py-3.5">
        <label className="relative min-w-[260px] flex-1">
          <span className="sr-only">Tìm dịch vụ</span>
          <Search
            size={15}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm tên dịch vụ"
            className="h-10 w-full rounded-[10px] border border-line-input bg-cream-50 pl-9 pr-10 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-navy-700 focus:bg-white focus:outline-none focus:ring-3 focus:ring-gold-500/30"
          />
          {text ? (
            <button
              type="button"
              aria-label="Xoá từ khoá"
              onClick={() => setText("")}
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
          aria-label="Nhóm dịch vụ"
          className="flex overflow-x-auto rounded-[10px] bg-segment p-[3px]"
        >
          {tabs.map((t) => {
            const on = filters.category === t.value;
            return (
              <button
                key={t.value || "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilters({ category: t.value })}
                className={`h-[32px] whitespace-nowrap rounded-[8px] px-3 text-[13px] transition-colors ${
                  on
                    ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={`ml-1.5 font-normal tabular-nums ${on ? "text-gold-700" : "text-ink-faint"}`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Hàng 2 ===== */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line bg-table-head px-[18px] py-2.5">
        <SelectChip
          label="Trạng thái"
          value={filters.status}
          onChange={(v) => setFilters({ status: v as ServiceStatusFilter })}
          options={SERVICE_STATUS_OPTIONS}
        />
        <SelectChip
          label="Sắp xếp"
          value={`${filters.sort}:${filters.order}`}
          onChange={(v) => {
            const [sort, order] = v.split(":") as [ServiceSort, "asc" | "desc" | ""];
            setFilters({ sort, order });
          }}
          options={SERVICE_SORT_OPTIONS}
        />

        {isFiltered && (
          <button
            type="button"
            onClick={clearAll}
            className="whitespace-nowrap px-1 text-[12.5px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Xoá lọc
          </button>
        )}

        <span className="ml-auto whitespace-nowrap text-[12px] tabular-nums text-ink-faint">
          Hiển thị {shown} trong {total}
        </span>
      </div>
    </div>
  );
}
