/**
 * prisma/seed.ts
 *
 * Tạo bộ dữ liệu mẫu ĐẦY ĐỦ cho mọi màn hình:
 *   role, ca làm, 9 nhân viên + lịch trực 3 tuần,
 *   6 loại phòng, 29 phòng (5 tầng), 11 dịch vụ,
 *   30 khách hàng (10 thành viên có tài khoản), ghi chú khách,
 *   ~90 booking (đang ở, sắp đến, chờ duyệt, đã huỷ, lịch sử 5 tháng)
 *   kèm phòng, dịch vụ đã dùng, hoá đơn, thanh toán, lịch sử trạng thái phòng.
 *
 * Chạy:  npx tsx prisma/seed.ts
 *
 * Chạy lại nhiều lần được. Mỗi lần chạy:
 *   - Role, ca, nhân viên, loại phòng, phòng, dịch vụ: CHỈ TẠO NẾU CHƯA CÓ,
 *     không ghi đè dữ liệu bạn đã sửa (giá, ảnh phòng...).
 *   - ⚠ XOÁ SẠCH booking, hoá đơn, thanh toán rồi tạo lại.
 *   - Khách hàng mẫu (SĐT/email trong data.ts) bị xoá và tạo lại.
 *     Khách bạn tự nhập tay thì giữ nguyên.
 */
import 'dotenv/config';
import { PrismaClient, type RoomStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  BLOCKED_ROOMS,
  CUSTOMER_NOTES,
  CUSTOMERS,
  DEFAULT_PASSWORD,
  EMPLOYEES,
  ROLES,
  ROOM_TYPES,
  ROOMS,
  ROSTER,
  SERVICES,
  SHIFTS,
} from './seed/data';
import {
  planBookings,
  type SeedRoom,
  type SeedService,
} from './seed/plan-bookings';
import { addDays, dateOnly, mondayOf, todayYmd, vnTime } from './seed/utils';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Không chạy seed trên môi trường production.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

type EmployeeIds = Map<string, { id: string; accountId: string }>;

/* ============================ Danh mục (chỉ tạo nếu chưa có) ============================ */

async function seedRoles() {
  for (const name of ROLES) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`  ✓ ${ROLES.length} role`);
}

async function seedShifts() {
  const map = new Map<string, string>(); // code -> shift.id
  for (const s of SHIFTS) {
    const shift = await prisma.shift.upsert({
      where: { name: s.name },
      update: { start_time: toTime(s.start), end_time: toTime(s.end) },
      create: {
        name: s.name,
        start_time: toTime(s.start),
        end_time: toTime(s.end),
      },
    });
    map.set(s.code, shift.id);
  }
  console.log(`  ✓ ${SHIFTS.length} ca làm`);
  return map;
}

async function seedEmployees(hash: string): Promise<EmployeeIds> {
  const map: EmployeeIds = new Map();

  for (const e of EMPLOYEES) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: e.role },
    });

    const account = await prisma.account.upsert({
      where: { email: e.email },
      update: { is_active: true },
      create: { email: e.email, hash_password: hash, is_active: true },
    });

    await prisma.roleAccount.deleteMany({ where: { account_id: account.id } });
    await prisma.roleAccount.create({
      data: { account_id: account.id, role_id: role.id },
    });

    const data = {
      first_name: e.first,
      last_name: e.last,
      email: e.email,
      phone: e.phone,
      position: e.position,
      salary: e.salary,
      hired_date: dateOnly(e.hired),
      gender: e.gender,
    };
    const employee = await prisma.employee.upsert({
      where: { account_id: account.id },
      update: data,
      create: { account_id: account.id, ...data },
    });

    map.set(e.key, { id: employee.id, accountId: account.id });
  }

  console.log(`  ✓ ${EMPLOYEES.length} nhân viên`);
  return map;
}

async function seedAssignments(
  shiftIds: Map<string, string>,
  employees: EmployeeIds,
  today: string,
) {
  const monday = mondayOf(today);
  const rows: { employee_id: string; shift_id: string; work_date: Date }[] = [];

  // 3 tuần: tuần trước, tuần này, tuần sau
  for (const [w, weekOffset] of [-1, 0, 1].entries()) {
    for (let day = 0; day < 7; day++) {
      const workDate = addDays(monday, weekOffset * 7 + day);
      for (const [key, pattern] of Object.entries(ROSTER)) {
        const code = pattern[(day + w) % 7]; // xoay lịch mỗi tuần 1 ngày
        if (!code) continue;
        rows.push({
          employee_id: employees.get(key)!.id,
          shift_id: shiftIds.get(code)!,
          work_date: dateOnly(workDate),
        });
      }
    }
  }

  const from = addDays(monday, -7);
  const to = addDays(monday, 13);
  await prisma.employeeShift.deleteMany({
    where: { work_date: { gte: dateOnly(from), lte: dateOnly(to) } },
  });
  await prisma.employeeShift.createMany({ data: rows, skipDuplicates: true });

  console.log(`  ✓ ${rows.length} lượt phân công (${from} → ${to})`);
}

async function seedRoomTypes() {
  for (const t of ROOM_TYPES) {
    await prisma.roomType.upsert({
      where: { name: t.name },
      update: {}, // đã có thì giữ nguyên giá / tiện ích bạn đã sửa
      create: t,
    });
  }
  const types = await prisma.roomType.findMany({
    select: { id: true, name: true },
  });
  console.log(`  ✓ ${ROOM_TYPES.length} loại phòng`);
  return new Map(types.map((t) => [t.name, t.id]));
}

async function seedRooms(typeIds: Map<string, string>): Promise<SeedRoom[]> {
  for (const r of ROOMS) {
    await prisma.room.upsert({
      where: { room_number: r.number },
      update: {}, // giữ ảnh, loại phòng bạn đã sửa
      create: {
        room_number: r.number,
        floor: r.floor,
        room_type_id: typeIds.get(r.type)!,
        status: 'available',
      },
    });
  }

  // Đọc lại từ DB: nếu bạn đã đổi loại phòng của 1 phòng mẫu thì dùng đúng loại hiện tại
  const rows = await prisma.room.findMany({
    where: { room_number: { in: ROOMS.map((r) => r.number) } },
    select: {
      id: true,
      room_number: true,
      room_type: { select: { name: true, base_price: true, capacity: true } },
    },
    orderBy: { room_number: 'asc' },
  });

  console.log(`  ✓ ${rows.length} phòng`);
  return rows.map((r) => ({
    id: r.id,
    number: r.room_number,
    typeName: r.room_type.name,
    price: Number(r.room_type.base_price), // Decimal -> number
    capacity: r.room_type.capacity,
  }));
}

async function seedServices(): Promise<SeedService[]> {
  const result: SeedService[] = [];
  for (const s of SERVICES) {
    const data = {
      name: s.name,
      category: s.category,
      unit: s.unit,
      price: s.price,
      is_active: s.is_active ?? true,
    };
    // Tìm theo tên mới hoặc tên cũ (lần seed trước) -> cập nhật tại chỗ, giữ nguyên id.
    // Không tìm thấy thì tạo mới. Nhờ vậy chạy seed nhiều lần không sinh dịch vụ trùng.
    const existing = await prisma.service.findFirst({
      where: {
        name: { in: [s.name, ...(s.legacyName ? [s.legacyName] : [])] },
      },
      select: { id: true },
    });
    const saved = existing
      ? await prisma.service.update({ where: { id: existing.id }, data })
      : await prisma.service.create({ data });
    result.push({ key: s.key, id: saved.id, price: Number(saved.price) });
  }
  console.log(`  ✓ ${SERVICES.length} dịch vụ`);
  return result;
}

/* ============================ Dọn dữ liệu giao dịch cũ ============================ */

async function wipeTransactions(seedRoomIds: string[]) {
  // Xoá con trước, cha sau: vướng khoá ngoại thì Postgres báo lỗi
  const [payments, , invoices, , bookings] = await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.bookingService.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.bookingRoom.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.roomStatusHistory.deleteMany({
      where: { room_id: { in: seedRoomIds } },
    }),
  ]);
  // Xoá hết booking -> đánh số mã booking lại từ 1
  await prisma.$executeRawUnsafe(
    'ALTER SEQUENCE "booking_code_seq" RESTART WITH 1',
  );

  // Khách mẫu: nhận diện bằng SĐT / email trong data.ts
  const phones = CUSTOMERS.map((c) => c.phone);
  const emails = CUSTOMERS.flatMap((c) => (c.email ? [c.email] : []));
  const old = await prisma.customer.findMany({
    where: {
      OR: [{ phone: { in: phones } }, { account: { email: { in: emails } } }],
    },
    select: { id: true },
  });
  const oldIds = old.map((c) => c.id);
  const accounts = await prisma.account.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);

  await prisma.$transaction([
    prisma.customerNote.deleteMany({ where: { customer_id: { in: oldIds } } }),
    prisma.customer.deleteMany({ where: { id: { in: oldIds } } }),
    prisma.refreshToken.deleteMany({
      where: { account_id: { in: accountIds } },
    }),
    prisma.roleAccount.deleteMany({
      where: { account_id: { in: accountIds } },
    }),
    prisma.roomStatusHistory.updateMany({
      where: { changed_by: { in: accountIds } },
      data: { changed_by: null },
    }),
    prisma.account.deleteMany({ where: { id: { in: accountIds } } }),
  ]);

  console.log(
    `  ✓ Đã xoá ${bookings.count} booking, ${invoices.count} hoá đơn, ${payments.count} thanh toán, ${oldIds.length} khách mẫu cũ`,
  );
}

/* ============================ Khách hàng, booking, trạng thái phòng ============================ */

async function seedCustomers(
  hash: string,
  today: string,
  plan: ReturnType<typeof planBookings>,
): Promise<{ ids: Map<string, string>; accountIds: Map<string, string> }> {
  const customerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'customer' },
  });
  const ids = new Map<string, string>();
  const accountIds = new Map<string, string>(); // chỉ thành viên có tài khoản

  for (const c of CUSTOMERS) {
    // Ngày tạo hồ sơ phải TRƯỚC booking đầu tiên của khách
    const firstBooking = plan.firstSeen.get(c.key);
    const joined = c.member
      ? vnTime(addDays(today, -c.member.joinedDaysAgo), '10:00')
      : undefined;
    const candidates = [
      joined,
      firstBooking && new Date(firstBooking.getTime() - 60_000),
    ].filter((d): d is Date => d instanceof Date);
    const createdAt = candidates.length
      ? new Date(Math.min(...candidates.map((d) => d.getTime())))
      : vnTime(addDays(today, -1), '10:00');

    if (c.member && !c.email)
      throw new Error(`Thành viên "${c.key}" phải có email`);

    const created = await prisma.customer.create({
      data: {
        first_name: c.first,
        last_name: c.last,
        phone: c.phone,
        email: c.email ?? null,
        id_type: c.id_type ?? null,
        id_card: c.id_card ?? null,
        nationality: c.nationality,
        reward_points: plan.points.get(c.key) ?? 0,
        source: c.member ? 'online_registration' : 'walk_in',
        registered_at: c.member ? createdAt : null,
        created_at: createdAt,
        ...(c.member && {
          account: {
            create: {
              email: c.email!,
              hash_password: hash,
              is_active: !c.member.locked,
              created_at: createdAt,
              role_account: { create: { role_id: customerRole.id } },
            },
          },
        }),
      },
      select: { id: true, account_id: true },
    });
    ids.set(c.key, created.id);
    if (created.account_id) accountIds.set(c.key, created.account_id);
  }

  const members = CUSTOMERS.filter((c) => c.member).length;
  console.log(`  ✓ ${CUSTOMERS.length} khách hàng (${members} thành viên)`);
  return { ids, accountIds };
}

async function seedBookings(
  plan: ReturnType<typeof planBookings>,
  customers: { ids: Map<string, string>; accountIds: Map<string, string> },
  employees: EmployeeIds,
) {
  const emp = (key: string | null) => (key ? employees.get(key)!.id : null);

  /** 'employee:lan' -> account của Lan; 'customer:quan' -> account của khách Quân */
  const cancellerAccount = (by: string) => {
    const [kind, key] = by.split(':');
    const id =
      kind === 'employee'
        ? employees.get(key)?.accountId
        : customers.accountIds.get(key);
    if (!id) throw new Error(`Không tìm thấy tài khoản cho "${by}"`);
    return id;
  };

  for (const b of plan.bookings) {
    const inv = b.invoice;

    // Nested create: 1 lệnh tạo luôn booking + phòng + dịch vụ + hoá đơn + thanh toán
    await prisma.booking.create({
      data: {
        code: b.code,
        customer_id: customers.ids.get(b.customerKey)!,
        booking_type: b.type,
        status: b.status,
        check_in_date: dateOnly(b.from),
        check_out_date: dateOnly(b.to),
        adults: b.adults,
        children: b.children,
        note: b.note,
        created_at: b.createdAt,
        created_by: emp(b.createdBy),
        confirmed_by: emp(b.confirmedBy),
        confirmed_at: b.confirmedAt,
        checked_in_by: emp(b.checkedInBy),
        actual_check_in: b.actualIn,
        checked_out_by: emp(b.checkedOutBy),
        actual_check_out: b.actualOut,
        cancelled_by: b.cancel ? cancellerAccount(b.cancel.by) : null,
        cancelled_at: b.cancel?.at ?? null,
        cancel_reason: b.cancel?.reason ?? null,
        booking_rooms: {
          create: b.rooms.map((r) => ({
            room_id: r.id,
            price_per_night: r.price,
          })),
        },
        booking_services: {
          create: b.services.map((s) => ({
            service_id: s.serviceId,
            quantity: s.qty,
            unit_price: s.unitPrice,
            total_price: s.unitPrice * s.qty,
            used_at: s.usedAt,
          })),
        },
        ...(inv && {
          invoices: {
            create: {
              total_amount: inv.total,
              discount: inv.discount,
              final_amount: inv.final,
              status: inv.status,
              created_at: inv.createdAt,
              payments: {
                create: inv.payments.map((p) => ({
                  amount: p.amount,
                  payment_method: p.method,
                  paid_at: p.paidAt,
                  created_at: p.paidAt,
                  reference_number: p.reference,
                  received_by: emp(p.receivedBy),
                })),
              },
            },
          },
        }),
      },
    });
  }

  // Mã booking tạo trong app sau này chạy tiếp sau mã cuối của seed
  await prisma.$executeRawUnsafe(
    `SELECT setval('"booking_code_seq"', ${plan.bookings.length + 1}, false)`,
  );

  const count = (s: string) =>
    plan.bookings.filter((b) => b.status === s).length;
  const invoices = plan.bookings.filter((b) => b.invoice).length;
  const payments = plan.bookings.reduce(
    (n, b) => n + (b.invoice?.payments.length ?? 0),
    0,
  );
  console.log(
    `  ✓ ${plan.bookings.length} booking: ${count('checked_in')} đang ở, ${count('confirmed')} đã xác nhận, ` +
      `${count('pending')} chờ duyệt, ${count('checked_out')} đã trả phòng, ${count('cancelled')} đã huỷ, ${count('no_show')} không đến`,
  );
  console.log(`  ✓ ${invoices} hoá đơn, ${payments} thanh toán`);
}

async function seedRoomStatus(
  plan: ReturnType<typeof planBookings>,
  rooms: SeedRoom[],
  employees: EmployeeIds,
) {
  // Gom theo trạng thái -> mỗi trạng thái 1 lệnh updateMany
  const groups = new Map<RoomStatus, string[]>();
  for (const [roomId, status] of plan.roomStatus) {
    groups.set(status, [...(groups.get(status) ?? []), roomId]);
  }
  for (const [status, ids] of groups) {
    await prisma.room.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  }

  // Phòng bạn tự tạo đang "Có khách" nhưng booking đã bị xoá -> trả về "Trống"
  const fixed = await prisma.room.updateMany({
    where: { id: { notIn: rooms.map((r) => r.id) }, status: 'occupied' },
    data: { status: 'available' },
  });

  await prisma.roomStatusHistory.createMany({
    data: plan.roomEvents.map((e) => ({
      room_id: e.roomId,
      old_status: e.from,
      new_status: e.to,
      changed_at: e.at,
      changed_by: employees.get(e.by)!.accountId,
    })),
  });

  const summary = [...groups]
    .map(([s, ids]) => `${ids.length} ${s}`)
    .join(', ');
  console.log(`  ✓ Trạng thái phòng: ${summary}`);
  console.log(`  ✓ ${plan.roomEvents.length} dòng lịch sử trạng thái phòng`);
  if (fixed.count)
    console.log(
      `  ✓ ${fixed.count} phòng khác đang "occupied" không có booking -> available`,
    );
}

async function seedNotes(
  customerIds: Map<string, string>,
  employees: EmployeeIds,
  today: string,
) {
  await prisma.customerNote.createMany({
    data: CUSTOMER_NOTES.map((n) => ({
      customer_id: customerIds.get(n.customer)!,
      author_id: employees.get(n.author)!.id,
      content: n.content,
      created_at: vnTime(addDays(today, -n.daysAgo), '15:30'),
    })),
  });
  console.log(`  ✓ ${CUSTOMER_NOTES.length} ghi chú khách hàng`);
}

/* ============================ main ============================ */

async function main() {
  const today = todayYmd();
  const now = new Date();
  const host = new URL(process.env.DATABASE_URL ?? 'postgres://unknown').host;
  console.log(`Seeding vào ${host}, hôm nay (giờ VN) = ${today}\n`);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log('Danh mục');
  await seedRoles();
  const shiftIds = await seedShifts();
  const employees = await seedEmployees(hash);
  await seedAssignments(shiftIds, employees, today);
  const typeIds = await seedRoomTypes();
  const rooms = await seedRooms(typeIds);
  const services = await seedServices();

  console.log('\nGiao dịch');
  await wipeTransactions(rooms.map((r) => r.id));
  const plan = planBookings({ today, now, rooms, services });
  const customers = await seedCustomers(hash, today, plan);
  await seedBookings(plan, customers, employees);
  await seedRoomStatus(plan, rooms, employees);
  await seedNotes(customers.ids, employees, today);

  console.log(`\nXong. Mật khẩu mọi tài khoản: ${DEFAULT_PASSWORD}`);
  console.table([
    { role: 'admin', email: 'admin@hotel.local' },
    { role: 'manager', email: 'bang@hotel.local' },
    { role: 'staff', email: 'lan@hotel.local' },
    { role: 'customer', email: 'khoa.tran@example.com' },
    { role: 'customer (bị khoá)', email: 'quan.vo@example.com' },
  ]);
  const blocked = Object.entries(BLOCKED_ROOMS)
    .map(([n, b]) => `${n} ${b.status}`)
    .join(', ');
  console.log(`Phòng không kinh doanh: ${blocked}`);
}

main()
  .catch((e) => {
    console.error('Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
