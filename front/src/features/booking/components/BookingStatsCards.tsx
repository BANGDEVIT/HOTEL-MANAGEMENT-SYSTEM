import { BedDouble, Clock3, LogIn, LogOut, type LucideIcon } from 'lucide-react';
import { useBookingStore } from '../store/bookingStore';
import type { BookingTab } from '../../../types/booking';

/**
 * 4 ô số liệu = 4 câu hỏi lễ tân hỏi đầu ca. Bấm ô nào thì chuyển sang tab đó.
 * Số lấy từ /bookings/stats: BE đếm bằng CÙNG điều kiện với tab -> bấm vào luôn thấy đúng số dòng.
 */
interface Card {
  tab: BookingTab;
  label: string;
  icon: LucideIcon;
  tint: string;
  value: number | undefined;
  note: string;
  hot?: boolean;
}

export default function BookingStatsCards() {
  const stats = useBookingStore((s) => s.stats);
  const tab = useBookingStore((s) => s.filters.tab);
  const setFilters = useBookingStore((s) => s.setFilters);

  const cards: Card[] = [
    {
      tab: 'pending',
      label: 'Chờ duyệt',
      icon: Clock3,
      tint: 'var(--color-gold-700)',
      value: stats?.pending,
      note: stats?.pending ? 'yêu cầu online cần xử lý' : 'không có yêu cầu nào',
      hot: !!stats?.pending,
    },
    {
      tab: 'arrivals',
      label: 'Đến hôm nay',
      icon: LogIn,
      tint: 'var(--color-navy-700)',
      value: stats?.arrivals,
      note: stats?.arrivals_overdue ? `gồm ${stats.arrivals_overdue} khách trễ từ hôm trước` : 'chờ nhận phòng',
    },
    {
      tab: 'in_house',
      label: 'Đang ở',
      icon: BedDouble,
      tint: 'var(--color-room-available)',
      value: stats?.in_house,
      note: stats ? `công suất phòng ${stats.occupancy_rate.toLocaleString('vi-VN')}%` : ' ',
    },
    {
      tab: 'departures',
      label: 'Đi hôm nay',
      icon: LogOut,
      tint: 'var(--color-room-maintenance)',
      value: stats?.departures,
      note: stats?.departures_overdue ? `${stats.departures_overdue} khách quá hạn trả phòng` : 'trả phòng trước 12:00',
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {cards.map(({ tab: cardTab, label, icon: Icon, tint, value, note, hot }) => {
        const active = tab === cardTab;
        return (
          <button
            key={cardTab}
            type="button"
            aria-pressed={active}
            onClick={() => setFilters({ tab: cardTab })}
            className={`rounded-[16px] border px-4 py-3.5 text-left transition-colors ${
              active
                ? 'border-navy-700 bg-white shadow-[inset_0_0_0_1px_var(--color-navy-700)]'
                : hot
                  ? 'border-gold-500/50 bg-[#FFFCF4] hover:border-gold-500'
                  : 'border-line bg-white hover:border-line-input'
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
                style={{ color: tint, background: `color-mix(in srgb, ${tint} 10%, transparent)` }}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[12.5px] text-ink-secondary">{label}</span>
                <span className="block text-[24px] font-bold leading-tight tabular-nums text-ink">{value ?? '–'}</span>
              </span>
            </span>
            <span className="mt-3 block truncate border-t border-line-soft pt-2 text-[11.5px] text-ink-faint">{note}</span>
          </button>
        );
      })}
    </div>
  );
}
