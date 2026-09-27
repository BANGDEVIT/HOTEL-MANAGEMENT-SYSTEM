/**
 * LẬP KẾ HOẠCH booking hoàn toàn trong bộ nhớ, chưa đụng tới database.
 *
 * Tách riêng "tính toán" và "ghi DB" vì:
 *   - Cần biết trước mọi booking thì mới tính được: ngày tạo khách, điểm thưởng,
 *     trạng thái cuối cùng của từng phòng, lịch sử đổi trạng thái phòng.
 *   - Hàm thuần (không gọi DB) dễ đọc, dễ kiểm tra.
 *
 * Quy tắc nghiệp vụ được đảm bảo:
 *   1. Một phòng không bị 2 booking (chưa huỷ) chồng ngày: [from, to) giao nhau là trùng.
 *      Trả phòng sáng, nhận phòng chiều cùng ngày thì không tính là trùng.
 *   2. Phòng bảo trì / ngưng kinh doanh không nhận booking từ hôm nay trở đi.
 *   3. Hoá đơn = tiền phòng (giá/đêm x số đêm) + dịch vụ - giảm giá.
 *   4. Booking pending / cancelled chưa có hoá đơn.
 *   5. Không thời điểm nào nằm trong tương lai (trừ ngày check-in/out dự kiến).
 */
import type {
  BookingStatus,
  BookingType,
  InvoiceStatus,
  PaymentMethod,
  RoomStatus,
} from '@prisma/client';
import {
  BLOCKED_ROOMS,
  CUSTOMERS,
  HISTORY_COUNT,
  HOUSEKEEPER,
  RANDOM_SEED,
  RECEPTIONISTS,
  SCRIPTED_BOOKINGS,
  SERVICES,
  TYPE_WEIGHTS,
  VND_PER_POINT,
} from './data';
import {
  addDays,
  createRng,
  minutes,
  nightsBetween,
  roundTo,
  vnTime,
} from './utils';

/* ============================ Kiểu dữ liệu ============================ */

export interface SeedRoom {
  id: string;
  number: string;
  typeName: string;
  price: number;
}

export interface SeedService {
  key: string;
  id: string;
  price: number;
}

export interface PlannedPayment {
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  reference: string | null;
}

export interface PlannedInvoice {
  total: number;
  discount: number;
  final: number;
  status: InvoiceStatus;
  createdAt: Date;
  payments: PlannedPayment[];
}

export interface PlannedBooking {
  customerKey: string;
  type: BookingType;
  status: BookingStatus;
  createdBy: string | null; // employee key
  from: string;
  to: string;
  createdAt: Date;
  actualIn: Date | null;
  actualOut: Date | null;
  rooms: SeedRoom[];
  services: {
    serviceId: string;
    qty: number;
    unitPrice: number;
    usedAt: Date;
  }[];
  invoice: PlannedInvoice | null;
}

export interface RoomEvent {
  roomId: string;
  from: RoomStatus;
  to: RoomStatus;
  at: Date;
  by: string; // employee key
}

export interface Plan {
  bookings: PlannedBooking[];
  roomStatus: Map<string, RoomStatus>; // roomId -> trạng thái cuối
  roomEvents: RoomEvent[];
  points: Map<string, number>; // customerKey -> điểm thưởng
  firstSeen: Map<string, Date>; // customerKey -> lần đầu xuất hiện
}

interface BookingSpec {
  customerKey: string;
  typeNames: string[];
  from: string;
  to: string;
  status: BookingStatus;
  type: BookingType;
  by?: string;
  services?: [string, number][];
  randomServices?: boolean;
  shuffleRooms?: boolean;
}

/* ============================ Lập kế hoạch ============================ */

export function planBookings(input: {
  today: string;
  now: Date;
  rooms: SeedRoom[];
  services: SeedService[];
}): Plan {
  const { today, now, rooms } = input;
  const rng = createRng(RANDOM_SEED);

  const members = new Set(CUSTOMERS.filter((c) => c.member).map((c) => c.key));
  const serviceByKey = new Map(input.services.map((s) => [s.key, s]));
  const activeServiceKeys = SERVICES.filter((s) => s.is_active !== false).map(
    (s) => s.key,
  );
  const blocked = new Set(
    rooms.filter((r) => BLOCKED_ROOMS[r.number]).map((r) => r.id),
  );

  const roomsByType = new Map<string, SeedRoom[]>();
  for (const r of rooms) {
    const list = roomsByType.get(r.typeName) ?? [];
    list.push(r);
    roomsByType.set(r.typeName, list);
  }

  /** Thời điểm không được vượt quá "bây giờ" */
  const notFuture = (d: Date) =>
    d > now ? new Date(now.getTime() - minutes(rng.int(5, 40))) : d;

  /* ----- Lịch bận của từng phòng ----- */
  const busy = new Map<string, [string, string][]>();

  const isFree = (room: SeedRoom, from: string, to: string) => {
    if (blocked.has(room.id) && to > today) return false;
    // Chuỗi "YYYY-MM-DD" so sánh được trực tiếp như ngày
    return !(busy.get(room.id) ?? []).some(([f, t]) => from < t && f < to);
  };

  /** Chọn phòng trống cho cả khoảng ngày. Không đủ phòng -> null */
  const allocate = (
    typeNames: string[],
    from: string,
    to: string,
    shuffle: boolean,
  ) => {
    const picked: SeedRoom[] = [];
    for (const typeName of typeNames) {
      const pool = roomsByType.get(typeName) ?? [];
      const order = shuffle ? rng.shuffle(pool) : pool;
      const room = order.find(
        (r) => !picked.includes(r) && isFree(r, from, to),
      );
      if (!room) return null;
      picked.push(room);
    }
    for (const r of picked)
      busy.set(r.id, [...(busy.get(r.id) ?? []), [from, to]]);
    return picked;
  };

  /* ----- Tạo 1 booking từ mô tả ----- */
  const build = (spec: BookingSpec): PlannedBooking | null => {
    // Booking đã huỷ không giữ phòng nhưng vẫn cần ghi phòng khách đã chọn
    const holdsRoom = spec.status !== 'cancelled';
    const picked = holdsRoom
      ? allocate(spec.typeNames, spec.from, spec.to, spec.shuffleRooms ?? false)
      : spec.typeNames.map((t) => rng.pick(roomsByType.get(t) ?? []));
    if (!picked || picked.some((r) => !r)) return null;

    const nights = nightsBetween(spec.from, spec.to);
    const stayed =
      spec.status === 'checked_in' || spec.status === 'checked_out';

    const actualIn = stayed
      ? notFuture(vnTime(spec.from, rng.clock(13, 19)))
      : null;
    const actualOut =
      spec.status === 'checked_out'
        ? notFuture(vnTime(spec.to, rng.clock(9, 12)))
        : null;

    // Ngày tạo booking
    let createdAt: Date;
    if (spec.status === 'pending') {
      createdAt = new Date(now.getTime() - minutes(rng.int(30, 48 * 60)));
    } else if (spec.type === 'online') {
      createdAt = notFuture(
        vnTime(addDays(spec.from, -rng.int(2, 30)), rng.clock(7, 23)),
      );
    } else if (actualIn) {
      createdAt = new Date(actualIn.getTime() - minutes(rng.int(5, 20))); // làm thủ tục tại quầy
    } else {
      createdAt = notFuture(
        vnTime(addDays(today, -rng.int(1, 3)), rng.clock(8, 21)),
      ); // gọi điện đặt trước
    }

    const createdBy =
      spec.type === 'walk_in' ? (spec.by ?? rng.pick(RECEPTIONISTS)) : null;

    // Dịch vụ: chỉ có khi khách đã/đang ở
    const serviceLines: [string, number][] = stayed
      ? (spec.services ?? (spec.randomServices ? randomServices(nights) : []))
      : [];
    const services = serviceLines.map(([key, qty]) => {
      const s = serviceByKey.get(key);
      if (!s) throw new Error(`Không có dịch vụ "${key}" trong SERVICES`);
      return {
        serviceId: s.id,
        qty,
        unitPrice: s.price,
        usedAt: rng.between(actualIn!, actualOut ?? now),
      };
    });

    const booking: PlannedBooking = {
      customerKey: spec.customerKey,
      type: spec.type,
      status: spec.status,
      createdBy,
      from: spec.from,
      to: spec.to,
      createdAt,
      actualIn,
      actualOut,
      rooms: picked,
      services,
      invoice: null,
    };
    booking.invoice = buildInvoice(
      booking,
      nights,
      spec.randomServices === true,
    );
    return booking;
  };

  function randomServices(nights: number): [string, number][] {
    const count = rng.weighted([
      [0, 3],
      [1, 3],
      [2, 2],
      [3, 1],
    ] as const);
    const keys = rng.shuffle(activeServiceKeys).slice(0, count);
    return keys.map((key) => {
      const def = SERVICES.find((s) => s.key === key)!;
      const qty =
        def.qty === 'per_night'
          ? nights * rng.int(1, 2)
          : rng.int(def.qty[0], def.qty[1]);
      return [key, qty];
    });
  }

  function buildInvoice(
    b: PlannedBooking,
    nights: number,
    allowDiscount: boolean,
  ): PlannedInvoice | null {
    if (b.status === 'pending' || b.status === 'cancelled') return null;

    const roomTotal = b.rooms.reduce((sum, r) => sum + r.price * nights, 0);
    const serviceTotal = b.services.reduce(
      (sum, s) => sum + s.unitPrice * s.qty,
      0,
    );
    const total = roomTotal + serviceTotal;
    // Thành viên thỉnh thoảng được giảm 5%
    const discount =
      allowDiscount && members.has(b.customerKey) && rng.chance(0.35)
        ? roundTo(total * 0.05)
        : 0;
    const final = total - discount;

    const payments: PlannedPayment[] = [];
    let paid = 0;

    // Đặt online: cọc 30% ngay sau khi đặt
    if (b.type === 'online') {
      const deposit = roundTo(final * 0.3);
      const method = rng.pick(['bank_transfer', 'e_wallet'] as const);
      // Cọc 10-120 phút sau khi đặt; booking vừa đặt xong thì cọc nằm giữa lúc đặt và bây giờ
      const planned = new Date(
        b.createdAt.getTime() + minutes(rng.int(10, 120)),
      );
      const paidAt = planned > now ? rng.between(b.createdAt, now) : planned;
      payments.push({
        amount: deposit,
        method,
        paidAt,
        reference: reference(method, paidAt),
      });
      paid += deposit;
    }

    // Đã trả phòng: thanh toán phần còn lại lúc check-out
    if (b.status === 'checked_out') {
      const method = rng.weighted([
        ['cash', 4],
        ['credit_card', 3],
        ['bank_transfer', 2],
        ['e_wallet', 1],
      ] as const);
      const paidAt = b.actualOut!;
      payments.push({
        amount: final - paid,
        method,
        paidAt,
        reference: reference(method, paidAt),
      });
      paid = final;
    }

    const status: InvoiceStatus =
      paid >= final ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid';
    const createdAt =
      b.type === 'online' ? b.createdAt : (b.actualIn ?? b.createdAt);

    return { total, discount, final, status, createdAt, payments };
  }

  function reference(method: PaymentMethod, at: Date): string | null {
    const ymd = at.toISOString().slice(2, 10).replace(/-/g, '');
    if (method === 'bank_transfer')
      return `FT${ymd}${rng.int(100_000, 999_999)}`;
    if (method === 'e_wallet')
      return `MOMO${rng.int(1_000_000_000, 9_999_999_999)}`;
    if (method === 'credit_card') return `POS${ymd}${rng.int(1000, 9999)}`;
    return null; // tiền mặt không có mã giao dịch
  }

  /* ----- 1. Booking kịch bản (xếp trước để chắc chắn có phòng) ----- */
  const bookings: PlannedBooking[] = [];

  for (const s of SCRIPTED_BOOKINGS) {
    const b = build({
      customerKey: s.customer,
      typeNames: s.rooms,
      from: addDays(today, s.from),
      to: addDays(today, s.to),
      status: s.status,
      type: s.type,
      by: s.by,
      services: s.services,
    });
    if (!b) {
      throw new Error(
        `Hết phòng ${s.rooms.join(', ')} cho booking của "${s.customer}" (${s.from}..${s.to}). Thêm phòng trong LAYOUT hoặc đổi ngày.`,
      );
    }
    bookings.push(b);
  }

  /* ----- 2. Booking lịch sử ngẫu nhiên (đã trả phòng) ----- */
  const pool = CUSTOMERS.flatMap((c) => Array<string>(c.weight).fill(c.key));
  let made = 0;
  for (
    let attempt = 0;
    made < HISTORY_COUNT && attempt < HISTORY_COUNT * 10;
    attempt++
  ) {
    const nights = rng.pick([1, 1, 2, 2, 2, 3, 3, 4, 5]);
    // to <= hôm qua: không lẫn với nhóm "trả phòng hôm nay" ở trên
    const from = addDays(today, -rng.int(nights + 1, 150));
    const typeName = rng.weighted(TYPE_WEIGHTS);

    const b = build({
      customerKey: rng.pick(pool),
      typeNames: rng.chance(0.1) ? [typeName, typeName] : [typeName],
      from,
      to: addDays(from, nights),
      status: 'checked_out',
      type: rng.chance(0.6) ? 'online' : 'walk_in',
      randomServices: true,
      shuffleRooms: true,
    });
    if (b) {
      bookings.push(b);
      made++;
    }
  }

  bookings.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    bookings,
    ...roomOutcome(bookings, rooms, today, now, rng),
    ...customerOutcome(bookings, members),
  };
}

/* ============================ Kết quả suy ra ============================ */

/** Trạng thái cuối của từng phòng + lịch sử đổi trạng thái */
function roomOutcome(
  bookings: PlannedBooking[],
  rooms: SeedRoom[],
  today: string,
  now: Date,
  rng: ReturnType<typeof createRng>,
) {
  const roomStatus = new Map<string, RoomStatus>(
    rooms.map((r) => [r.id, 'available']),
  );
  const roomEvents: RoomEvent[] = [];

  for (const b of bookings) {
    if (!b.actualIn) continue;
    const by = b.createdBy ?? rng.pick(RECEPTIONISTS);

    for (const room of b.rooms) {
      roomEvents.push({
        roomId: room.id,
        from: 'available',
        to: 'occupied',
        at: b.actualIn,
        by,
      });

      if (b.status === 'checked_in') {
        roomStatus.set(room.id, 'occupied');
        continue;
      }

      // Trả phòng -> đang dọn -> trống (dọn xong sau 1-2 tiếng)
      roomEvents.push({
        roomId: room.id,
        from: 'occupied',
        to: 'cleaning',
        at: b.actualOut!,
        by,
      });
      const cleanedAt = new Date(
        b.actualOut!.getTime() + minutes(rng.int(60, 120)),
      );

      if (b.to === today && cleanedAt > now) {
        roomStatus.set(room.id, 'cleaning'); // trả sáng nay, chưa dọn xong
      } else {
        roomEvents.push({
          roomId: room.id,
          from: 'cleaning',
          to: 'available',
          at: cleanedAt,
          by: HOUSEKEEPER,
        });
      }
    }
  }

  // Trả phòng hôm nay mà giờ chạy script đã quá 2 tiếng -> vẫn cho 1 phòng "đang dọn"
  // để màn hình luôn có đủ 4 trạng thái
  if (![...roomStatus.values()].includes('cleaning')) {
    const todayOut = bookings.find(
      (b) => b.status === 'checked_out' && b.to === today,
    );
    if (todayOut) {
      const room = todayOut.rooms[0];
      roomStatus.set(room.id, 'cleaning');
      const i = roomEvents.findIndex(
        (e) =>
          e.roomId === room.id &&
          e.to === 'available' &&
          e.at >= todayOut.actualOut!,
      );
      if (i >= 0) roomEvents.splice(i, 1);
    }
  }

  for (const r of rooms) {
    const block = BLOCKED_ROOMS[r.number];
    if (!block) continue;
    roomStatus.set(r.id, block.status);
    const at = notFutureFixed(
      vnTime(addDays(today, -block.daysAgo), '09:15'),
      now,
    );
    roomEvents.push({
      roomId: r.id,
      from: 'available',
      to: block.status,
      at,
      by: block.by,
    });
  }

  roomEvents.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { roomStatus, roomEvents };
}

const notFutureFixed = (d: Date, now: Date) =>
  d > now ? new Date(now.getTime() - minutes(30)) : d;

/** Điểm thưởng + lần đầu xuất hiện của từng khách */
function customerOutcome(bookings: PlannedBooking[], members: Set<string>) {
  const points = new Map<string, number>();
  const firstSeen = new Map<string, Date>();

  for (const b of bookings) {
    const seen = firstSeen.get(b.customerKey);
    if (!seen || b.createdAt < seen) firstSeen.set(b.customerKey, b.createdAt);

    // Chỉ thành viên tích điểm, chỉ tính booking đã thanh toán đủ
    if (members.has(b.customerKey) && b.invoice?.status === 'paid') {
      const add = Math.floor(b.invoice.final / VND_PER_POINT);
      points.set(b.customerKey, (points.get(b.customerKey) ?? 0) + add);
    }
  }

  return { points, firstSeen };
}
