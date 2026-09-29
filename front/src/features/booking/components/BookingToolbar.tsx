import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { DEFAULT_FILTERS, useBookingStore } from '../store/bookingStore';
import {
  BOOKING_SORT_OPTIONS,
  BOOKING_TYPE_LABELS,
  TAB_LABELS,
  type BookingSort,
  type BookingStats,
  type BookingTab,
  type BookingType,
} from '../../../types/booking';
import { SelectChip } from './ui';

const TABS: BookingTab[] = ['all', 'pending', 'arrivals', 'in_house', 'departures', 'upcoming', 'history'];
const SEARCH_DELAY_MS = 350;

/** Số trên tab: tab nào có trong /stats thì hiện, "Tất cả" và "Lịch sử" không đếm */
const tabCount = (tab: BookingTab, stats: BookingStats | null): number | undefined =>
  stats && tab in stats ? stats[tab as keyof BookingStats] : undefined;

/** Ghi chú ngắn dưới bảng cho những tab có luật đặc biệt */
const TAB_HINTS: Partial<Record<BookingTab, string>> = {
  arrivals: 'gồm cả khách lẽ ra đến từ hôm trước',
  departures: 'gồm cả khách quá hạn trả phòng',
  pending: 'yêu cầu gửi trước được xếp lên đầu',
};

/**
 * 2 hàng:
 *   1. Ô tìm kiếm + tab (Tất cả · Chờ duyệt · Đến · Đang ở · Đi · Sắp tới · Lịch sử)
 *   2. Khoảng ngày, nguồn đặt, sắp xếp, xoá lọc, số kết quả
 */
export default function BookingToolbar() {
  const filters = useBookingStore((s) => s.filters);
  const stats = useBookingStore((s) => s.stats);
  const total = useBookingStore((s) => s.total);
  const shown = useBookingStore((s) => s.bookings.length);
  const setFilters = useBookingStore((s) => s.setFilters);
  const resetFilters = useBookingStore((s) => s.resetFilters);

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
      if (e.key !== '/' || el.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const isFiltered =
    filters.search.trim() !== '' ||
    filters.booking_type !== DEFAULT_FILTERS.booking_type ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.sort !== '';

  const clearAll = () => {
    setText('');
    resetFilters();
  };

  const dateInput =
    'h-8 rounded-[8px] border border-line bg-white px-2 text-[12.5px] tabular-nums text-ink hover:border-line-input focus:border-navy-700 focus:outline-none';

  return (
    <div>
      {/* ===== Hàng 1 ===== */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-[18px] py-3.5">
        <label className="relative min-w-[300px] flex-1">
          <span className="sr-only">Tìm đặt phòng</span>
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
            placeholder="Tìm mã BK, tên khách, SĐT hoặc số phòng"
            className="h-10 w-full rounded-[10px] border border-line-input bg-cream-50 pl-9 pr-10 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-navy-700 focus:bg-white focus:outline-none focus:ring-3 focus:ring-gold-500/30"
          />
          {text ? (
            <button
              type="button"
              aria-label="Xoá từ khoá"
              onClick={() => setText('')}
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

        <div role="tablist" aria-label="Nhóm đặt phòng" className="flex overflow-x-auto rounded-[10px] bg-segment p-[3px]">
          {TABS.map((t) => {
            const on = filters.tab === t;
            const count = tabCount(t, stats);
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilters({ tab: t })}
                className={`h-[32px] whitespace-nowrap rounded-[8px] px-3 text-[13px] transition-colors ${
                  on ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {TAB_LABELS[t]}
                {count !== undefined && (
                  <span className={`ml-1.5 font-normal tabular-nums ${on ? 'text-gold-700' : 'text-ink-faint'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Hàng 2 ===== */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line bg-table-head px-[18px] py-2.5">
        <div role="group" aria-label="Khoảng ngày ở" className="flex items-center gap-1.5 text-[12px] text-ink-faint">
          <span className="whitespace-nowrap">Ngày ở:</span>
          <input
            type="date"
            aria-label="Từ ngày"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters({ from: e.target.value })}
            className={dateInput}
          />
          <span>–</span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters({ to: e.target.value })}
            className={dateInput}
          />
        </div>

        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

        <SelectChip
          label="Nguồn"
          value={filters.booking_type}
          onChange={(v) => setFilters({ booking_type: v as BookingType | '' })}
          options={[
            { value: '', label: 'Tất cả' },
            ...(Object.keys(BOOKING_TYPE_LABELS) as BookingType[]).map((t) => ({ value: t, label: BOOKING_TYPE_LABELS[t] })),
          ]}
        />

        <SelectChip
          label="Sắp xếp"
          value={filters.sort ? `${filters.sort}:${filters.order}` : ''}
          onChange={(v) => {
            const [sort, order] = (v ? v.split(':') : ['', '']) as [BookingSort | '', 'asc' | 'desc' | ''];
            setFilters({ sort, order });
          }}
          options={BOOKING_SORT_OPTIONS}
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
          {TAB_HINTS[filters.tab] && ` · ${TAB_HINTS[filters.tab]}`}
        </span>
      </div>
    </div>
  );
}
