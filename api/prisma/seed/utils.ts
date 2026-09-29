/**
 * Helper ngày giờ + bộ sinh số ngẫu nhiên cho seed.
 *
 * Quy ước ngày trong cả project:
 *   - Cột @db.Date  -> Date lúc 00:00 UTC của ngày đó ("2026-09-27T00:00:00Z")
 *   - Cột timestamp -> thời điểm thật, viết kèm múi giờ +07:00 cho dễ đọc
 *   - "Hôm nay" luôn tính theo giờ Việt Nam, không theo giờ máy chạy script
 */

export const VN_TZ = 'Asia/Ho_Chi_Minh';

/** "2026-09-27" theo giờ Việt Nam */
export const todayYmd = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: VN_TZ });

/** "2026-09-27" -> Date 00:00 UTC, dùng cho cột @db.Date */
export const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export const addDays = (ymd: string, n: number) => {
  const d = dateOnly(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Thời điểm cụ thể theo giờ VN: vnTime("2026-09-27", "14:05") */
export const vnTime = (ymd: string, hhmm: string) =>
  new Date(`${ymd}T${hhmm}:00+07:00`);

export const nightsBetween = (from: string, to: string) =>
  Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000);

/** Thứ 2 của tuần chứa ngày ymd */
export const mondayOf = (ymd: string) => {
  const dow = dateOnly(ymd).getUTCDay(); // 0 = CN
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
};

/**
 * Mã booking "BK-YYMMDD-NNNN": ngày tạo theo giờ VN + số thứ tự.
 * padStart KHÔNG cắt số: vượt 9999 thì thành 5 chữ số, không bị trùng.
 */
export function bookingCode(createdAt: Date, seq: number): string {
  const ymd = createdAt
    .toLocaleDateString('sv-SE', { timeZone: VN_TZ })
    .replace(/-/g, '')
    .slice(2);
  return `BK-${ymd}-${String(seq).padStart(4, '0')}`;
}

export const roundTo = (n: number, step = 1000) => Math.round(n / step) * step;

export const minutes = (n: number) => n * 60_000;

/**
 * Bộ sinh số ngẫu nhiên CÓ HẠT GIỐNG (mulberry32).
 * Cùng hạt giống -> cùng dãy số -> chạy seed lần nào cũng ra cùng một bộ dữ liệu
 * (chỉ ngày tháng dịch theo hôm nay). Math.random() thì mỗi lần mỗi khác, khó debug.
 */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T =>
    list[Math.floor(next() * list.length)];
  const chance = (p: number) => next() < p;

  /** Chọn theo trọng số: weighted([['a', 3], ['b', 1]]) -> 'a' 75%, 'b' 25% */
  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = next() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r < 0) return value;
    }
    return entries[entries.length - 1][0];
  };

  const shuffle = <T>(list: readonly T[]): T[] => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  /** Giờ ngẫu nhiên "HH:MM" trong khoảng [fromHour, toHour) */
  const clock = (fromHour: number, toHour: number) => {
    const total = int(fromHour * 60, toHour * 60 - 1);
    const h = String(Math.floor(total / 60)).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  /** Thời điểm ngẫu nhiên nằm giữa 2 mốc */
  const between = (from: Date, to: Date) =>
    new Date(
      from.getTime() +
        Math.floor(next() * Math.max(0, to.getTime() - from.getTime())),
    );

  return { next, int, pick, chance, weighted, shuffle, clock, between };
}

export type Rng = ReturnType<typeof createRng>;
