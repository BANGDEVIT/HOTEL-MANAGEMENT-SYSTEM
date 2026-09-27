import type { Shift } from "../../../types/shift";
import { addDaysYmd, DAY_LABELS, dayMonth, fromYmd } from "./week";

/** 12_600_000 ms -> "3 giờ 30 phút" */
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h > 0 ? `${d} ngày ${h} giờ` : `${d} ngày`;
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  return `${m} phút`;
}

/** Số giờ của 1 ca. Ca đêm 22:00 -> 06:00 = 8 giờ, không phải -16 */
export function shiftHours(shift: Shift): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let mins = toMin(shift.end_time) - toMin(shift.start_time);
  if (mins <= 0) mins += 1440; // qua nửa đêm -> cộng thêm 24 giờ
  return mins / 60;
}

/** "hôm nay", "ngày mai", hoặc "thứ 6 25/09" */
export function relativeDay(ymd: string, today: string): string {
  if (ymd === today) return "hôm nay";
  if (ymd === addDaysYmd(today, 1)) return "ngày mai";
  if (ymd === addDaysYmd(today, -1)) return "hôm qua";
  const name = DAY_LABELS[(fromYmd(ymd).getDay() + 6) % 7];
  return `${name.toLowerCase()} ${dayMonth(ymd)}`;
}
