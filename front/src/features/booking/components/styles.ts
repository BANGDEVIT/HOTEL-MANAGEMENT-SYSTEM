/**
 * Class Tailwind dùng lại cho nút, ô nhập của màn Đặt phòng.
 * Tách khỏi ui.tsx: file .tsx chỉ nên export component, không thì Fast Refresh
 * phải tải lại cả trang thay vì chỉ thay component (luật react-refresh/only-export-components).
 */
export const INPUT =
  "h-10 w-full rounded-[10px] border border-line-input bg-white px-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-navy-700 focus:outline-none focus:ring-3 focus:ring-gold-500/30 disabled:bg-cream-50 disabled:text-ink-faint";
export const BTN_PRIMARY =
  "h-10 whitespace-nowrap rounded-[10px] bg-navy-700 px-5 text-[13.5px] font-semibold text-white hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_GOLD =
  "h-10 whitespace-nowrap rounded-[10px] bg-gold-500 px-5 text-[13.5px] font-semibold text-navy-900 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_DANGER =
  "h-10 whitespace-nowrap rounded-[10px] bg-room-occupied px-5 text-[13.5px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_SECONDARY =
  "h-10 whitespace-nowrap rounded-[10px] border border-line-input bg-white px-4 text-[13px] font-medium text-ink hover:border-navy-700 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_SMALL =
  "h-8 whitespace-nowrap rounded-[8px] border border-line-input bg-white px-3 text-[12.5px] font-medium text-ink hover:border-navy-700 disabled:opacity-50";
export const LINK_BTN =
  "whitespace-nowrap text-[12.5px] font-medium text-navy-700 hover:underline disabled:opacity-50";
