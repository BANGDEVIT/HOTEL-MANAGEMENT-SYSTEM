import {
  ArrowRight,
  BedDouble,
  RotateCcw,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useCustomerStore } from "../store/customerStore";

/**
 * 4 ô số liệu. Lấy từ /customers/stats -> số của CẢ khách sạn, lọc bảng thế nào cũng không đổi.
 * Ô "Đang lưu trú" và "Sắp đến" bấm được: bấm = lọc bảng theo tình trạng đó.
 */

interface Card {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string; // màu icon
  value: string;
  note: React.ReactNode;
  stay?: "in_house" | "arriving";
}

export default function CustomerStatsCards() {
  const stats = useCustomerStore((s) => s.stats);
  const activeStay = useCustomerStore((s) => s.filters.stay);
  const setFilters = useCustomerStore((s) => s.setFilters);

  const month = new Date().toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "numeric",
  });
  const diff = stats ? stats.new_this_month - stats.new_last_month : 0;

  const cards: Card[] = [
    {
      key: "in_house",
      label: "Đang lưu trú",
      icon: BedDouble,
      tint: "var(--color-room-available)",
      value: stats ? String(stats.in_house) : "–",
      note: "khách đang ở khách sạn",
      stay: "in_house",
    },
    {
      key: "arriving",
      label: "Sắp đến hôm nay",
      icon: ArrowRight,
      tint: "var(--color-navy-700)",
      value: stats ? String(stats.arriving_today) : "–",
      note: "có booking nhận phòng hôm nay",
      stay: "arriving",
    },
    {
      key: "new",
      label: `Khách mới tháng ${month}`,
      icon: UserPlus,
      tint: "var(--color-gold-700)",
      value: stats ? String(stats.new_this_month) : "–",
      note: stats ? (
        <span
          style={{
            color:
              diff >= 0
                ? "var(--color-room-available)"
                : "var(--color-room-occupied)",
          }}
        >
          {diff >= 0 ? "+" : ""}
          {diff} so với tháng trước
        </span>
      ) : (
        " "
      ),
    },
    {
      key: "returning",
      label: "Tỉ lệ quay lại",
      icon: RotateCcw,
      tint: "var(--color-shift-night)",
      value: stats ? `${stats.returning_rate}%` : "–",
      note: "khách đã ở từ 2 lần trở lên",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {cards.map(({ key, label, icon: Icon, tint, value, note, stay }) => {
        // Chỉ bật khi đang lọc ĐÚNG MỘT tình trạng này
        const active = !!stay && activeStay.length === 1 && activeStay[0] === stay;

        const body = (
          <>
            <span className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  color: tint,
                  background: `color-mix(in srgb, ${tint} 10%, transparent)`,
                }}
              >
                <Icon
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[12.5px] text-ink-secondary">
                  {label}
                </span>
                <span className="block text-[24px] font-bold leading-tight tabular-nums text-ink">
                  {value}
                </span>
              </span>
            </span>
            <span className="mt-3 block whitespace-nowrap border-t border-line-soft pt-2 text-[11.5px] text-ink-faint">
              {note}
            </span>
          </>
        );

        const base = "rounded-[16px] border bg-white px-4 py-3.5 text-left";

        return stay ? (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => setFilters({ stay: active ? [] : [stay] })}
            className={`${base} transition-colors ${
              active
                ? "border-navy-700 shadow-[inset_0_0_0_1px_var(--color-navy-700)]"
                : "border-line hover:border-line-input"
            }`}
          >
            {body}
          </button>
        ) : (
          <div
            key={key}
            className={`${base} border-line`}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
