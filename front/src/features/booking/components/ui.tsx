/**
 * Mảnh giao diện nhỏ dùng chung trong màn Đặt phòng.
 * Mọi component khai báo ở cấp ngoài cùng file (DESIGN.md mục 8).
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import type { BookingStatus } from '../../../types/booking';
import { STATUS_META } from '../utils/format';

/* ============================ Class dùng lại ============================ */

export const INPUT =
  'h-10 w-full rounded-[10px] border border-line-input bg-white px-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-navy-700 focus:outline-none focus:ring-3 focus:ring-gold-500/30 disabled:bg-cream-50 disabled:text-ink-faint';
export const BTN_PRIMARY =
  'h-10 whitespace-nowrap rounded-[10px] bg-navy-700 px-5 text-[13.5px] font-semibold text-white hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_GOLD =
  'h-10 whitespace-nowrap rounded-[10px] bg-gold-500 px-5 text-[13.5px] font-semibold text-navy-900 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_DANGER =
  'h-10 whitespace-nowrap rounded-[10px] bg-room-occupied px-5 text-[13.5px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_SECONDARY =
  'h-10 whitespace-nowrap rounded-[10px] border border-line-input bg-white px-4 text-[13px] font-medium text-ink hover:border-navy-700 disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_SMALL =
  'h-8 whitespace-nowrap rounded-[8px] border border-line-input bg-white px-3 text-[12.5px] font-medium text-ink hover:border-navy-700 disabled:opacity-50';
export const LINK_BTN = 'whitespace-nowrap text-[12.5px] font-medium text-navy-700 hover:underline disabled:opacity-50';

/* ============================ Pill trạng thái ============================ */

export function StatusPill({ status, className = '' }: { status: BookingStatus; className?: string }) {
  const { label, color } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ${className}`}
      style={{ color, background: `color-mix(in srgb, ${color} 11%, white)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 py-px text-[10.5px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

/* ============================ Ô form ============================ */

export function Field({
  label,
  required,
  error,
  hint,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
        {label}
        {required && <span className="ml-0.5 text-room-occupied">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[12px] text-room-occupied">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11.5px] text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

/** Nhóm nút chọn 1 (segmented): loại giấy tờ, hình thức thanh toán... */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-10 rounded-[10px] bg-segment p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-[8px] px-2 text-[13px] transition-colors ${
            value === o.value ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(20,38,59,.1)]' : 'text-ink-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ô số có nút − / + (số khách, số lượng dịch vụ) */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const btn = 'h-full w-9 text-[16px] text-ink hover:bg-segment disabled:opacity-30';
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-line-input bg-white">
      <button type="button" aria-label={`Bớt ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}>
        −
      </button>
      <span className="flex-1 text-center text-[14px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`Thêm ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
        +
      </button>
    </div>
  );
}

/**
 * Ô chọn dạng chip: <select> gốc phủ trong suốt lên trên -> bàn phím, trình đọc màn hình chạy sẵn.
 */
export function SelectChip({
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
  const current = options.find((o) => o.value === value)?.label ?? '';
  const active = value !== options[0]?.value;
  return (
    <label
      className={`relative flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] border pl-3 pr-2 text-[12.5px] ${
        active ? 'border-gold-500 bg-gold-50' : 'border-line bg-white hover:border-line-input'
      }`}
    >
      <span className="text-ink-faint">{label}:</span>
      <span className="font-medium text-ink">{current}</span>
      <ChevronDown size={13} strokeWidth={2} className="text-ink-faint" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ============================ Khung hộp thoại ============================ */

/**
 * Khung chung cho mọi hộp thoại của màn này: nền mờ, Esc / bấm nền để đóng, header + footer.
 * busy = đang gửi request -> không cho đóng giữa chừng.
 * aria-modal="true" -> drawer biết đang có hộp thoại mở, phím Esc chỉ đóng hộp thoại.
 *
 * Render qua PORTAL vào document.body: hộp thoại thường được mở từ trong drawer, mà drawer có
 * `transform` (hiệu ứng trượt). Phần tử `fixed` nằm trong cha có transform sẽ bị "nhốt" trong cha đó
 * -> hộp thoại chỉ hiện trong khung drawer. Portal đưa nó ra ngoài, phủ đúng cả màn hình.
 */
export function DialogShell({
  title,
  subtitle,
  width = 560,
  busy = false,
  onClose,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  width?: number;
  busy?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/45 p-4 pt-[6vh]"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit?.();
        }}
        style={{ width }}
        className="flex max-h-[88vh] max-w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_24px_60px_rgba(20,38,59,.35)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-bold text-navy-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] tabular-nums text-ink-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-ink-muted hover:bg-segment"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-table-head px-6 py-3.5">
          {footer}
        </footer>
      </form>
    </div>,
    document.body,
  );
}
