import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Lương ẩn mặc định, bấm mới hiện — màn hình quản lý thường mở ở quầy */
export default function SalaryCell({ salary }: { salary: number }) {
  const [shown, setShown] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      aria-label={shown ? "Ẩn lương" : "Xem lương"}
      className="flex items-center gap-1.5 text-[12px] tabular-nums rounded hover:text-[#14181D] group"
    >
      <span className={shown ? "text-[#14181D]" : "text-[#98A1AC] tracking-[2px]"}>
        {shown ? Number(salary).toLocaleString("vi-VN") : "••••••"}
      </span>
      {shown ? (
        <EyeOff
          size={12}
          strokeWidth={1.75}
          className="text-[#98A1AC]"
        />
      ) : (
        <Eye
          size={12}
          strokeWidth={1.75}
          className="text-[#CDD2D8] group-hover:text-[#98A1AC]"
        />
      )}
    </button>
  );
}
