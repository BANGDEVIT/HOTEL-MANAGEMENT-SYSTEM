import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { DEFAULT_FILTERS, useInvoiceStore } from "../store/invoiceStore";
import {
  CREATED_OPTIONS,
  INVOICE_SORT_OPTIONS,
  INVOICE_TAB_LABELS,
  type CreatedPreset,
  type InvoiceSort,
  type InvoiceTab,
  type PaymentMethod,
} from "../../../types/invoice";
import { METHOD_FILTER_OPTIONS } from "../utils/invoiceMeta";
import { SelectChip } from "../../booking/components/ui";

const SEARCH_DELAY_MS = 350;
const TABS = Object.keys(INVOICE_TAB_LABELS) as InvoiceTab[];

/**
 * 2 hàng:
 *   1. Ô tìm kiếm + tab (kèm số lượng; Công nợ có số nền đỏ)
 *   2. Phương thức, ngày lập, sắp xếp, xoá lọc, số kết quả
 */
export default function InvoiceToolbar() {
  const filters = useInvoiceStore((s) => s.filters);
  const tabs = useInvoiceStore((s) => s.stats?.tabs);
  const total = useInvoiceStore((s) => s.total);
  const setFilters = useInvoiceStore((s) => s.setFilters);
  const resetFilters = useInvoiceStore((s) => s.resetFilters);

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
    filters.method !== "" ||
    filters.created !== "" ||
    filters.sort !== DEFAULT_FILTERS.sort ||
    filters.order !== DEFAULT_FILTERS.order;

  const clearAll = () => {
    setText("");
    resetFilters();
  };

  return (
    <div>
      {/* ===== Hàng 1 ===== */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-[18px] py-3.5">
        <label className="relative min-w-[280px] flex-1">
          <span className="sr-only">Tìm hoá đơn</span>
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
            placeholder="Số hoá đơn HD-…, mã đặt phòng, tên / SĐT khách, số phòng"
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
          aria-label="Nhóm hoá đơn"
          className="flex overflow-x-auto rounded-[10px] bg-segment p-[3px]"
        >
          {TABS.map((t) => {
            const on = filters.tab === t;
            const count = tabs?.[t];
            const alert = t === "debt" && !!count;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilters({ tab: t })}
                className={`flex h-[32px] items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-[13px] transition-colors ${
                  on
                    ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {INVOICE_TAB_LABELS[t]}
                {count !== undefined &&
                  (alert ? (
                    <span className="rounded-full bg-room-occupied px-1.5 text-[11px] font-semibold tabular-nums text-white">
                      {count}
                    </span>
                  ) : (
                    <span
                      className={`font-normal tabular-nums ${on ? "text-gold-700" : "text-ink-faint"}`}
                    >
                      {count}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Hàng 2 ===== */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line bg-table-head px-[18px] py-2.5">
        <SelectChip
          label="Phương thức"
          value={filters.method}
          onChange={(v) => setFilters({ method: v as PaymentMethod | "" })}
          options={METHOD_FILTER_OPTIONS}
        />
        <SelectChip
          label="Ngày lập"
          value={filters.created}
          onChange={(v) => setFilters({ created: v as CreatedPreset })}
          options={CREATED_OPTIONS}
        />
        <SelectChip
          label="Sắp xếp"
          value={`${filters.sort}:${filters.order}`}
          onChange={(v) => {
            const [sort, order] = v.split(":") as [InvoiceSort, "asc" | "desc"];
            setFilters({ sort, order });
          }}
          options={INVOICE_SORT_OPTIONS}
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

        <span className="ml-auto whitespace-nowrap text-[12.5px] tabular-nums text-ink-faint">
          {total} hoá đơn
        </span>
      </div>
    </div>
  );
}
