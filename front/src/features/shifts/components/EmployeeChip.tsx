import { useState } from "react";
import { X } from "lucide-react";
import type { ScheduleItem } from "../../../types/shift";
import { initialsOf } from "../utils/schedule";

interface AvatarProps {
  name: string;
  url: string | null;
  size?: number;
}

/** Có ảnh thì hiện ảnh, ảnh lỗi hoặc không có ảnh thì hiện chữ cái đầu */
export function EmployeeAvatar({ name, url, size = 20 }: AvatarProps) {
  const [broken, setBroken] = useState(false);

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)} // link S3 hỏng -> quay về chữ cái đầu
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="rounded-full bg-navy-700 text-white font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initialsOf(name)}
    </span>
  );
}

interface Props {
  item: ScheduleItem;
  /** Không truyền = ngày đã qua, không cho gỡ */
  onRemove?: (item: ScheduleItem) => Promise<void>;
  highlight?: boolean; // ô của chính người đang đăng nhập
}

export default function EmployeeChip({ item, onRemove, highlight = false }: Props) {
  const { employee } = item;

  return (
    <div
      title={`${employee.full_name}, ${employee.position}`}
      className={`group/chip flex items-center gap-1.5 h-7 pl-[3px] pr-1 mb-1 rounded-[5px] border ${
        highlight
          ? "border-[#C9A84C] bg-[#FFF9EC]"
          : "border-line bg-white hover:border-line-input"
      }`}
    >
      <EmployeeAvatar
        name={employee.full_name}
        url={employee.avatar_url}
      />
      <span
        className={`flex-1 min-w-0 truncate text-[11.5px] text-ink ${highlight ? "font-medium" : ""}`}
      >
        {employee.full_name}
      </span>

      {onRemove && (
        <button
          type="button"
          // Store đã toast lỗi + tự trả chip về -> ở đây chỉ nuốt lỗi
          // để không thành "Uncaught (in promise)" trên console
          onClick={() => onRemove(item).catch(() => {})}
          aria-label={`Gỡ ${employee.full_name} khỏi ca`}
          className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-ink-muted opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100 hover:bg-[#FDF4F2] hover:text-[#B4321F]"
        >
          <X
            size={12}
            strokeWidth={2}
          />
        </button>
      )}
    </div>
  );
}
