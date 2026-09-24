/** Thanh chạy mảnh báo đang tải. Đặt trong khung có position: relative */
export default function LoadingBar({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      role="progressbar"
      aria-label="Đang tải"
      className="absolute top-0 left-0 right-0 h-[2px] bg-[#E4E6E9] overflow-hidden z-10"
    >
      <div className="h-full w-1/3 bg-[#1B3A5C] rounded-full animate-[slide_1s_ease-in-out_infinite]" />
    </div>
  );
}
