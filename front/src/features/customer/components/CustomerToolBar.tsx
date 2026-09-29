import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { DEFAULT_FILTERS, useCustomerStore } from "../store/customerStore";
import {
  NATIONALITIES,
  SORT_OPTIONS,
  STAY_LABELS,
  type Membership,
  type StayStatus,
} from "../../../types/customer";

const STAYS: StayStatus[] = ["in_house", "arriving", "none"];
const SEARCH_DELAY_MS = 350;

/**
 * 2 hàng:
 *   1. Ô tìm kiếm (rộng) + tab Tất cả / Vãng lai / Thành viên (kèm số lượng)
 *   2. Lọc tình trạng lưu trú, quốc tịch, sắp xếp, xoá lọc, số kết quả
 */
export default function CustomerToolbar() {
  const filters = useCustomerStore((s) => s.filters);
  const stats = useCustomerStore((s) => s.stats);
  const total = useCustomerStore((s) => s.total);
  const shown = useCustomerStore((s) => s.customers.length);
  const setFilters = useCustomerStore((s) => s.setFilters);
  const resetFilters = useCustomerStore((s) => s.resetFilters);

  /* ----- Tìm kiếm: gõ xong 350ms mới gọi API, không gọi theo từng phím ----- */
  const [text, setText] = useState(filters.search);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (text.trim() === filters.search.trim()) return;
    const timer = setTimeout(() => setFilters({ search: text }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer); // gõ tiếp trước 350ms -> huỷ lần hẹn cũ
  }, [text, filters.search, setFilters]);

  // Phím "/" để nhảy vào ô tìm kiếm (trừ khi đang gõ trong ô khác)
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

  const toggleStay = (s: StayStatus) =>
    setFilters({
      stay: filters.stay.includes(s)
        ? filters.stay.filter((x) => x !== s)
        : [...filters.stay, s],
    });

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.nationality !== "" ||
    filters.membership !== "all" ||
    filters.stay.length > 0 ||
    filters.sort !== DEFAULT_FILTERS.sort ||
    filters.order !== DEFAULT_FILTERS.order;

  const clearAll = () => {
    setText("");
    resetFilters();
  };

  const tabs: { value: Membership | "all"; label: string; count?: number }[] = [
    { value: "all", label: "Tất cả", count: stats?.total },
    { value: "guest", label: "Vãng lai", count: stats?.guests },
    { value: "member", label: "Thành viên", count: stats?.members },
  ];

  return (
    <div>
      {/* ===== Hàng 1 ===== */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-[18px] py-3.5">
        <label className="relative min-w-[340px] flex-1">
          <span className="sr-only">Tìm khách</span>
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
            placeholder="Tìm theo tên, số điện thoại, email hoặc số giấy tờ"
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
          aria-label="Loại khách"
          className="flex rounded-[10px] bg-segment p-[3px]"
        >
          {tabs.map((t) => {
            const on = filters.membership === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilters({ membership: t.value })}
                className={`h-[32px] whitespace-nowrap rounded-[8px] px-3.5 text-[13px] transition-colors ${
                  on
                    ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="ml-1.5 font-normal tabular-nums text-ink-faint">
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
        <div
          role="group"
          aria-label="Tình trạng lưu trú"
          className="flex items-center gap-1.5"
        >
          <span className="mr-0.5 whitespace-nowrap text-[12px] text-ink-faint">
            Lưu trú:
          </span>
          {STAYS.map((s) => {
            const on = filters.stay.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStay(s)}
                className={`h-8 whitespace-nowrap rounded-[8px] border px-3 text-[12.5px] transition-colors ${
                  on
                    ? "border-gold-500 bg-gold-50 font-medium text-gold-700"
                    : "border-line bg-white text-ink-secondary hover:border-line-input"
                }`}
              >
                {STAY_LABELS[s]}
              </button>
            );
          })}
        </div>

        <span
          className="mx-1 h-5 w-px bg-line"
          aria-hidden="true"
        />

        <SelectChip
          label="Quốc tịch"
          value={filters.nationality}
          onChange={(v) => setFilters({ nationality: v })}
          options={[
            { value: "", label: "Tất cả" },
            ...NATIONALITIES.map((n) => ({ value: n, label: n })),
          ]}
        />

        <SelectChip
          label="Sắp xếp"
          value={`${filters.sort}:${filters.order}`}
          onChange={(v) => {
            const [sort, order] = v.split(":") as [
              typeof filters.sort,
              typeof filters.order,
            ];
            setFilters({ sort, order });
          }}
          options={SORT_OPTIONS}
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

/**
 * Ô chọn dạng "chip": dùng <select> gốc của trình duyệt (bàn phím, trình đọc màn hình
 * chạy sẵn), phủ lên trên để giữ giao diện chip. Khai báo ngoài component cha.
 */
function SelectChip({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  const active = value !== options[0]?.value;

  return (
    <label
      className={`relative flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] border pl-3 pr-2 text-[12.5px] ${
        active
          ? "border-gold-500 bg-gold-50"
          : "border-line bg-white hover:border-line-input"
      }`}
    >
      <span className="text-ink-faint">{label}:</span>
      <span className="font-medium text-ink">{current}</span>
      <ChevronDown
        size={13}
        strokeWidth={2}
        className="text-ink-faint"
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
          >
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
