const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Date -> "YYYY-MM-DD" theo giờ máy người dùng.
 *
 * KHÔNG dùng d.toISOString().slice(0, 10): toISOString đổi sang UTC,
 * nên từ 00:00 đến 06:59 sáng ở VN nó trả về NGÀY HÔM TRƯỚC.
 */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * "YYYY-MM-DD" -> Date lúc 00:00 giờ local.
 *
 * KHÔNG dùng new Date("2026-09-28"): chuỗi chỉ có ngày bị JS hiểu là UTC,
 * đọc lại bằng getDate() ở múi giờ âm sẽ lùi 1 ngày.
 */
export function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayYmd = () => toYmd(new Date());

export function addDaysYmd(ymd: string, n: number): string {
  const d = fromYmd(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

/** Thứ 2 của tuần chứa ngày truyền vào */
export function mondayOf(ymd: string): string {
  const d = fromYmd(ymd);
  const dow = d.getDay(); // 0 = CN, 1 = T2 ... 6 = T7
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toYmd(d);
}

/** 7 ngày của tuần, bắt đầu từ thứ 2 */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
}

/** So sánh chuỗi "YYYY-MM-DD" được luôn, vì đúng thứ tự năm-tháng-ngày */
export const isPast = (ymd: string) => ymd < todayYmd();

export const DAY_LABELS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];
export const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** "2026-09-28" -> "28/09" */
export const dayMonth = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** "28/09 – 04/10/2026" */
export function weekLabel(monday: string): string {
  const sunday = addDaysYmd(monday, 6);
  return `${dayMonth(monday)} – ${dayMonth(sunday)}/${sunday.slice(0, 4)}`;
}

/**
 * Số tuần theo chuẩn ISO 8601: tuần bắt đầu thứ 2,
 * tuần 1 là tuần chứa ngày thứ 5 đầu tiên của năm.
 */
export function isoWeek(ymd: string): number {
  const d = fromYmd(ymd);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // nhảy tới thứ 5 cùng tuần
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) /
        7,
    )
  );
}
