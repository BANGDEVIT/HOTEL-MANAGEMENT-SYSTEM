/**
 * prisma/seed.ts
 *
 * Tạo sẵn: 4 role, 3 ca làm, 9 nhân viên (kèm account), và lịch trực 3 tuần
 * (tuần trước - tuần này - tuần sau) để bấm nút ‹ › trên UI là có data.
 *
 * Chạy:  npx tsx prisma/seed.ts
 *
 * Script idempotent: chạy lại nhiều lần không tạo trùng.
 */
import 'dotenv/config';
import { PrismaClient, ShiftName } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/* ============================ dữ liệu ============================ */

const DEFAULT_PASSWORD = 'Hotel@123';

const ROLES = ['admin', 'manager', 'staff', 'customer'] as const;

// name là enum ShiftName trong schema: morning | afternoon | evening | night
// FE tự map sang nhãn tiếng Việt. "evening" để dành, hiện chưa dùng.
const SHIFTS = [
  { code: 'S', name: ShiftName.morning, start: '06:00', end: '14:00' },
  { code: 'C', name: ShiftName.afternoon, start: '14:00', end: '22:00' },
  { code: 'D', name: ShiftName.night, start: '22:00', end: '06:00' },
] as const;

const EMPLOYEES = [
  {
    key: 'admin',
    first: 'Trị',
    last: 'Trần Quản',
    email: 'admin@hotel.local',
    phone: '0900000001',
    position: 'Quản trị hệ thống',
    salary: 25_000_000,
    gender: 'male',
    role: 'admin',
    hired: '2022-01-10',
  },
  {
    key: 'bang',
    first: 'Bằng',
    last: 'Bùi Công',
    email: 'bang@hotel.local',
    phone: '0900000002',
    position: 'Quản lý lễ tân',
    salary: 18_000_000,
    gender: 'male',
    role: 'manager',
    hired: '2023-03-01',
  },
  {
    key: 'tuan',
    first: 'Tuấn',
    last: 'Lê Minh',
    email: 'tuan@hotel.local',
    phone: '0900000003',
    position: 'Quản lý ca',
    salary: 15_000_000,
    gender: 'male',
    role: 'manager',
    hired: '2023-08-15',
  },
  {
    key: 'lan',
    first: 'Lan',
    last: 'Nguyễn Thị',
    email: 'lan@hotel.local',
    phone: '0900000004',
    position: 'Lễ tân',
    salary: 9_500_000,
    gender: 'female',
    role: 'staff',
    hired: '2024-02-20',
  },
  {
    key: 'mai',
    first: 'Mai',
    last: 'Đỗ Thị',
    email: 'mai@hotel.local',
    phone: '0900000005',
    position: 'Lễ tân',
    salary: 9_000_000,
    gender: 'female',
    role: 'staff',
    hired: '2024-06-01',
  },
  {
    key: 'ha',
    first: 'Hà',
    last: 'Phạm Thu',
    email: 'ha@hotel.local',
    phone: '0900000006',
    position: 'Buồng phòng',
    salary: 8_500_000,
    gender: 'female',
    role: 'staff',
    hired: '2024-09-12',
  },
  {
    key: 'son',
    first: 'Sơn',
    last: 'Ngô Thanh',
    email: 'son@hotel.local',
    phone: '0900000007',
    position: 'Kỹ thuật',
    salary: 10_000_000,
    gender: 'male',
    role: 'staff',
    hired: '2023-11-05',
  },
  {
    key: 'hung',
    first: 'Hùng',
    last: 'Trần Văn',
    email: 'hung@hotel.local',
    phone: '0900000008',
    position: 'Bảo vệ',
    salary: 8_000_000,
    gender: 'male',
    role: 'staff',
    hired: '2024-01-08',
  },
  {
    key: 'dat',
    first: 'Đạt',
    last: 'Võ Quốc',
    email: 'dat@hotel.local',
    phone: '0900000009',
    position: 'Bảo vệ',
    salary: 8_000_000,
    gender: 'male',
    role: 'staff',
    hired: '2025-01-15',
  },
] as const;

/**
 * Lịch mẫu 1 tuần, theo thứ tự [T2, T3, T4, T5, T6, T7, CN].
 * 'S' ca sáng | 'C' ca chiều | 'D' ca đêm | null nghỉ.
 *
 * Cố ý để vài lỗ hổng để UI hiện đúng trạng thái "thiếu người":
 *   - T5 ca sáng chỉ có 1 người (cần 2)
 *   - T5 và CN ca đêm trống hoàn toàn
 * Và cố ý để Lan / Sơn 6 ca/tuần để cột "Số ca" đỏ lên.
 */
const ROSTER: Record<string, (string | null)[]> = {
  bang: ['S', null, null, null, 'S', null, 'C'],
  tuan: [null, 'C', 'S', null, 'C', 'C', 'S'],
  lan: ['S', 'S', 'C', 'S', 'C', 'S', null],
  mai: ['C', 'S', 'S', 'C', null, 'C', null],
  ha: [null, null, 'S', 'C', 'S', 'S', 'S'],
  son: ['C', 'C', 'C', null, 'S', 'C', 'C'],
  hung: ['D', null, 'D', null, 'D', 'D', null],
  dat: [null, 'D', null, null, 'D', null, null],
  // admin không xếp ca
};

/* ============================ helper ============================ */

/** "06:00" -> Date 1970-01-01T06:00:00Z. Phải có Z, xem giải thích trong service. */
const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

/** Thứ 2 (00:00 UTC) của tuần chứa ngày hôm nay. */
function mondayOfThisWeek(): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const dow = d.getUTCDay(); // 0 = CN
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/* ============================ seed ============================ */

async function seedRoles() {
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
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

async function seedEmployees() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const map = new Map<string, string>(); // key -> employee.id

  for (const e of EMPLOYEES) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: e.role },
    });

    // 1. Account
    const account = await prisma.account.upsert({
      where: { email: e.email },
      update: { is_active: true },
      create: { email: e.email, hash_password: hash, is_active: true },
    });

    // 2. Gán role (xoá cũ rồi tạo lại cho chắc, tránh trùng)
    await prisma.roleAccount.deleteMany({ where: { account_id: account.id } });
    await prisma.roleAccount.create({
      data: { account_id: account.id, role_id: role.id },
    });

    // 3. Employee
    const employee = await prisma.employee.upsert({
      where: { account_id: account.id },
      update: {
        first_name: e.first,
        last_name: e.last,
        email: e.email,
        phone: e.phone,
        position: e.position,
        salary: e.salary,
        hired_date: new Date(`${e.hired}T00:00:00Z`),
        gender: e.gender,
      },
      create: {
        account_id: account.id,
        first_name: e.first,
        last_name: e.last,
        email: e.email,
        phone: e.phone,
        position: e.position,
        salary: e.salary,
        hired_date: new Date(`${e.hired}T00:00:00Z`),
        gender: e.gender,
      },
    });

    map.set(e.key, employee.id);
  }

  console.log(
    `  ✓ ${EMPLOYEES.length} nhân viên (mật khẩu: ${DEFAULT_PASSWORD})`,
  );
  return map;
}

async function seedAssignments(
  shiftIds: Map<string, string>,
  employeeIds: Map<string, string>,
) {
  const monday = mondayOfThisWeek();
  const rows: { employee_id: string; shift_id: string; work_date: Date }[] = [];

  // 3 tuần: -1 (tuần trước), 0 (tuần này), +1 (tuần sau)
  for (const [w, weekOffset] of [-1, 0, 1].entries()) {
    const weekStart = addDays(monday, weekOffset * 7);

    for (let day = 0; day < 7; day++) {
      const workDate = addDays(weekStart, day);

      for (const [key, pattern] of Object.entries(ROSTER)) {
        // Xoay lịch mỗi tuần 1 ngày để 3 tuần không giống hệt nhau
        const code = pattern[(day + w) % 7];
        if (!code) continue;

        rows.push({
          employee_id: employeeIds.get(key)!,
          shift_id: shiftIds.get(code)!,
          work_date: workDate,
        });
      }
    }
  }

  // Xoá lịch cũ trong khoảng seed rồi tạo lại — chạy lại script không bị trùng
  const from = addDays(monday, -7);
  const to = addDays(monday, 13);
  await prisma.employeeShift.deleteMany({
    where: { work_date: { gte: from, lte: to } },
  });

  await prisma.employeeShift.createMany({ data: rows, skipDuplicates: true });

  console.log(
    `  ✓ ${rows.length} lượt phân công, từ ${ymd(from)} đến ${ymd(to)}`,
  );
  console.log(`    Tuần hiện tại bắt đầu: ${ymd(monday)}`);
}

async function main() {
  console.log('Seeding...');
  await seedRoles();
  const shiftIds = await seedShifts();
  const employeeIds = await seedEmployees();
  await seedAssignments(shiftIds, employeeIds);
  console.log('Xong.');
}

main()
  .catch((e) => {
    console.error('Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
