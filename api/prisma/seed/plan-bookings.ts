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
 *   6. Trạng thái hoá đơn suy ra từ tiền đã thu (phiếu đã huỷ không tính), giống app:
 *      đủ -> paid, một phần -> partially_paid, chưa thu -> unpaid.
 *      Đã trả phòng mà còn thiếu = công nợ (do phiếu thu bị huỷ sau khi trả phòng).
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
  MANAGERS,
  RECEPTIONISTS,
  SCRIPTED_BOOKINGS,
  type ScriptedPayment,
  SERVICES,
  TYPE_WEIGHTS,
  VND_PER_POINT,
} from './data';
import {
  addDays,
  bookingCode,
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
  capacity: number;
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
  receivedBy: string; // employee key
  note: string | null;
  voided: { by: string; at: Date; reason: string } | null; // by: employee key
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
  code: string; // gán sau khi sắp xếp theo thời điểm tạo
  customerKey: string;
  type: BookingType;
  status: BookingStatus;
  from: string;
  to: string;
  adults: number;
  children: number;
  note: string | null;
  createdAt: Date;
  createdBy: string | null; // employee key; null = khách tự đặt online
  confirmedBy: string | null;
  confirmedAt: Date | null;
  checkedInBy: string | null;
  actualIn: Date | null;
  checkedOutBy: string | null;
  actualOut: Date | null;
  /** by: 'employee:<key>' hoặc 'customer:<key>' (khách tự huỷ bằng tài khoản) */
  cancel: { by: string; at: Date; reason: string } | null;
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
  adults?: number;
  children?: number;
  note?: string;
  cancel?: { by: string; reason: string };
  payments?: ScriptedPayment[];
}

const isManager = (key: string) =>
  (MANAGERS as readonly string[]).includes(key);

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
    // online = khách tự đặt bằng tài khoản -> bắt buộc là thành viên
    if (spec.type === 'online' && !members.has(spec.customerKey)) {
      throw new Error(
        `"${spec.customerKey}" không phải thành viên nên không thể có booking online`,
      );
    }

    // Huỷ / không đến thì không giữ phòng, nhưng vẫn ghi phòng khách đã chọn
    const holdsRoom = spec.status !== 'cancelled' && spec.status !== 'no_show';
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
      // Gọi điện đặt trước: vài ngày trước NGÀY ĐẾN (hoặc trước hôm nay nếu ngày đến còn ở tương lai)
      const base = spec.from < today ? spec.from : today;
      createdAt = notFuture(
        vnTime(addDays(base, -rng.int(1, 4)), rng.clock(8, 21)),
      );
    }

    const createdBy =
      spec.type === 'walk_in' ? (spec.by ?? rng.pick(RECEPTIONISTS)) : null;

    // ----- Xác nhận: lễ tân tạo thì xác nhận luôn; khách tự đặt thì lễ tân duyệt sau -----
    // Huỷ bởi chính khách hoặc bị từ chối = huỷ lúc còn chờ duyệt -> chưa từng được xác nhận
    // Khách tự huỷ ('self') hoặc lễ tân (không phải quản lý) từ chối -> huỷ lúc còn chờ duyệt.
    // Quản lý huỷ -> booking đã được xác nhận trước đó (chỉ quản lý được huỷ booking đã xác nhận).
    const cancelledWhilePending =
      spec.status === 'cancelled' &&
      spec.type === 'online' &&
      !!spec.cancel &&
      !isManager(spec.cancel.by);
    let confirmedBy: string | null = null;
    let confirmedAt: Date | null = null;
    if (spec.status !== 'pending' && !cancelledWhilePending) {
      confirmedBy = createdBy ?? rng.pick(RECEPTIONISTS);
      confirmedAt = createdBy
        ? createdAt
        : notFuture(new Date(createdAt.getTime() + minutes(rng.int(15, 240))));
      if (actualIn && confirmedAt > actualIn) confirmedAt = createdAt;
    }

    // ----- Huỷ -----
    let cancel: PlannedBooking['cancel'] = null;
    if (spec.status === 'cancelled') {
      const c = spec.cancel ?? { by: rng.pick(MANAGERS), reason: 'Khách huỷ' };
      const deadline = vnTime(spec.from, '12:00');
      const start = confirmedAt ?? createdAt;
      const at = rng.between(start, deadline < now ? deadline : now);
      cancel = {
        by:
          c.by === 'self' ? `customer:${spec.customerKey}` : `employee:${c.by}`,
        at: at < start ? start : at,
        reason: c.reason,
      };
    }

    // ----- Số người: không vượt sức chứa các phòng đã chọn -----
    const capacity = picked.reduce((sum, r) => sum + r.capacity, 0);
    const adults = Math.min(
      spec.adults ?? rng.int(1, Math.min(2, capacity)),
      capacity,
    );
    const children = Math.min(
      spec.children ?? (rng.chance(0.2) ? rng.int(0, capacity - adults) : 0),
      capacity - adults,
    );

    const checkedInBy = actualIn
      ? (createdBy ?? rng.pick(RECEPTIONISTS))
      : null;
    const checkedOutBy = actualOut ? rng.pick(RECEPTIONISTS) : null;

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
      code: '', // gán sau khi sắp xếp
      customerKey: spec.customerKey,
      type: spec.type,
      status: spec.status,
      from: spec.from,
      to: spec.to,
      adults,
      children,
      note: spec.note ?? null,
      createdAt,
      createdBy,
      confirmedBy,
      confirmedAt,
      checkedInBy,
      actualIn,
      checkedOutBy,
      actualOut,
      cancel,
      rooms: picked,
      services,
      invoice: null,
    };
    booking.invoice = buildInvoice(
      booking,
      nights,
      spec.randomServices === true,
      spec.payments,
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

  /**
   * Hoá đơn tạo lúc CHECK-IN (chưa thu), dịch vụ cộng dần, thu nốt lúc CHECK-OUT.
   * Có thể tạm ứng trước khi đang ở. Kịch bản có thể tự khai phiếu thu (xem ScriptedPayment).
   */
  function buildInvoice(
    b: PlannedBooking,
    nights: number,
    random: boolean,
    scripted: ScriptedPayment[] | undefined,
  ): PlannedInvoice | null {
    if (b.status !== 'checked_in' && b.status !== 'checked_out') return null;

    const roomTotal = b.rooms.reduce((sum, r) => sum + r.price * nights, 0);
    const serviceTotal = b.services.reduce(
      (sum, s) => sum + s.unitPrice * s.qty,
      0,
    );
    const total = roomTotal + serviceTotal;
    // Thành viên thỉnh thoảng được giảm 5%
    const discount =
      random && members.has(b.customerKey) && rng.chance(0.35)
        ? roundTo(total * 0.05)
        : 0;
    const final = total - discount;

    const specs =
      scripted ?? (random ? randomPayments(b, final) : defaultPayments(b));
    const payments: PlannedPayment[] = [];
    const active = () =>
      payments.reduce((sum, p) => (p.voided ? sum : sum + p.amount), 0);

    for (const p of specs) {
      if (p.at === 'out' && b.status !== 'checked_out') {
        throw new Error(
          `Booking của "${b.customerKey}" chưa trả phòng, không có phiếu thu lúc trả phòng`,
        );
      }
      const amount = p.amount === 'rest' ? final - active() : p.amount;
      if (amount <= 0 || active() + amount > final) {
        throw new Error(
          `Phiếu thu ${amount}đ của "${b.customerKey}" vượt quá hoá đơn ${final}đ`,
        );
      }
      const base =
        p.at === 'in'
          ? new Date(b.actualIn!.getTime() + minutes(rng.int(3, 15)))
          : b.actualOut!;
      // Thu lại sau khi huỷ phiếu trước -> phiếu mới phải SAU lúc huỷ
      const prevVoid = payments[payments.length - 1]?.voided?.at;
      const paidAt = notFuture(
        prevVoid && prevVoid > base
          ? new Date(prevVoid.getTime() + minutes(2))
          : base,
      );
      const receivedBy =
        p.by ?? (p.at === 'in' ? b.checkedInBy! : b.checkedOutBy!);
      const voidAt =
        p.voided &&
        notFuture(
          new Date(paidAt.getTime() + minutes(p.voided.afterHours * 60)),
        );
      const voided = p.voided
        ? {
            by: p.voided.by,
            reason: p.voided.reason,
            at:
              voidAt! > paidAt ? voidAt! : new Date(paidAt.getTime() + 60_000),
          }
        : null;
      payments.push({
        amount,
        method: p.method,
        paidAt,
        reference: reference(p.method, paidAt),
        receivedBy,
        note: p.note ?? null,
        voided,
      });
    }

    return {
      total,
      discount,
      final,
      status: statusFor(final, active()),
      createdAt: b.actualIn!,
      payments,
    };
  }

  /** Mặc định: đã trả phòng -> thu đủ 1 lần lúc trả phòng; đang ở -> chưa thu */
  function defaultPayments(b: PlannedBooking): ScriptedPayment[] {
    if (b.status !== 'checked_out') return [];
    return [{ amount: 'rest', method: randomMethod(), at: 'out' }];
  }

  /** Lịch sử ngẫu nhiên: ~15% khách tạm ứng 30-50% lúc nhận phòng, phần còn lại thu lúc trả phòng */
  function randomPayments(b: PlannedBooking, final: number): ScriptedPayment[] {
    const rest = defaultPayments(b);
    if (!rng.chance(0.15)) return rest;
    const deposit = Math.min(
      final - 100_000,
      roundTo((final * rng.int(30, 50)) / 100, 100_000),
    );
    if (deposit <= 0) return rest;
    return [
      {
        amount: deposit,
        method: rng.pick(['cash', 'bank_transfer'] as const),
        at: 'in',
        note: 'Tạm ứng',
      },
      ...rest,
    ];
  }

  function randomMethod(): PaymentMethod {
    return rng.weighted([
      ['cash', 4],
      ['credit_card', 3],
      ['bank_transfer', 2],
      ['e_wallet', 1],
    ] as const);
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
      adults: s.adults,
      children: s.children,
      note: s.note,
      cancel: s.cancel,
      payments: s.payments,
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

    const customerKey = rng.pick(pool);
    const b = build({
      customerKey,
      typeNames: rng.chance(0.1) ? [typeName, typeName] : [typeName],
      from,
      to: addDays(from, nights),
      status: 'checked_out',
      // Chỉ thành viên mới tự đặt online được
      type: members.has(customerKey) && rng.chance(0.7) ? 'online' : 'walk_in',
      randomServices: true,
      shuffleRooms: true,
    });
    if (b) {
      bookings.push(b);
      made++;
    }
  }

  // Mã booking theo thứ tự tạo, giống cách sequence booking_code_seq cấp số trong app
  bookings.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  bookings.forEach((b, i) => (b.code = bookingCode(b.createdAt, i + 1)));

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

/** Giống invoiceStatusFor() ở src/modules/invoice/invoice.rules.ts */
function statusFor(final: number, paid: number): InvoiceStatus {
  if (paid >= final) return 'paid';
  return paid > 0 ? 'partially_paid' : 'unpaid';
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

    // Chỉ thành viên tích điểm, cộng lúc trả phòng trên số phải trả (giống app).
    // Phiếu thu bị huỷ sau đó không trừ lại điểm.
    if (members.has(b.customerKey) && b.status === 'checked_out' && b.invoice) {
      const add = Math.floor(b.invoice.final / VND_PER_POINT);
      points.set(b.customerKey, (points.get(b.customerKey) ?? 0) + add);
    }
  }

  return { points, firstSeen };
}
