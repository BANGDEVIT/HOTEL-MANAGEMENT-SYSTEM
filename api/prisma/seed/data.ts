/**
 * TOÀN BỘ dữ liệu tĩnh của seed nằm ở file này.
 * Muốn thêm phòng, khách, dịch vụ... chỉ cần sửa ở đây, không đụng vào logic.
 *
 * Ngày của booking viết dạng "lệch so với hôm nay": from: -2 = 2 ngày trước.
 * Nhờ vậy chạy seed hôm nào thì dữ liệu cũng "đang diễn ra" quanh hôm đó.
 */
import type {
  BedType,
  BookingStatus,
  BookingType,
  IdType,
  RoomStatus,
  ShiftName,
} from '@prisma/client';

export const DEFAULT_PASSWORD = 'Hotel@123';

/** Hạt giống ngẫu nhiên. Đổi số này = ra một bộ lịch sử booking khác */
export const RANDOM_SEED = 20260927;

/** Quy đổi điểm thưởng: 10.000đ đã thanh toán = 1 điểm. Chức năng check-out sau này dùng đúng quy tắc này */
export const VND_PER_POINT = 10_000;

/** Số booking lịch sử (đã trả phòng) sinh ngẫu nhiên trong 150 ngày qua */
export const HISTORY_COUNT = 60;

/* ============================ Tài khoản & nhân viên ============================ */

export const ROLES = ['admin', 'manager', 'staff', 'customer'] as const;

// "evening" để dành, hiện chưa dùng
export const SHIFTS: {
  code: 'S' | 'C' | 'D';
  name: ShiftName;
  start: string;
  end: string;
}[] = [
  { code: 'S', name: 'morning', start: '06:00', end: '14:00' },
  { code: 'C', name: 'afternoon', start: '14:00', end: '22:00' },
  { code: 'D', name: 'night', start: '22:00', end: '06:00' },
];

export interface EmployeeSeed {
  key: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  position: string;
  salary: number;
  gender: 'male' | 'female';
  role: (typeof ROLES)[number];
  hired: string;
}

export const EMPLOYEES: EmployeeSeed[] = [
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
];

/** Ai được ghi là "người tạo booking" cho khách đặt tại quầy */
export const RECEPTIONISTS = ['lan', 'mai', 'bang', 'tuan'] as const;
/** Quản lý: người duy nhất được huỷ booking đã xác nhận */
export const MANAGERS = ['bang', 'tuan'] as const;
/** Buồng phòng: người chuyển phòng từ "đang dọn" về "trống" */
export const HOUSEKEEPER = 'ha';

/**
 * Lịch trực mẫu 1 tuần [T2..CN]. 'S' sáng | 'C' chiều | 'D' đêm | null nghỉ.
 * Cố ý để vài lỗ hổng (T5 ca sáng thiếu 1 người, T5 và CN ca đêm trống)
 * và Lan / Sơn 6 ca/tuần để UI hiện cảnh báo.
 */
export const ROSTER: Record<string, ('S' | 'C' | 'D' | null)[]> = {
  bang: ['S', null, null, null, 'S', null, 'C'],
  tuan: [null, 'C', 'S', null, 'C', 'C', 'S'],
  lan: ['S', 'S', 'C', 'S', 'C', 'S', null],
  mai: ['C', 'S', 'S', 'C', null, 'C', null],
  ha: [null, null, 'S', 'C', 'S', 'S', 'S'],
  son: ['C', 'C', 'C', null, 'S', 'C', 'C'],
  hung: ['D', null, 'D', null, 'D', 'D', null],
  dat: [null, 'D', null, null, 'D', null, null],
};

/* ============================ Loại phòng & phòng ============================ */

export interface RoomTypeSeed {
  name: string;
  base_price: number;
  capacity: number;
  bed_type: BedType;
  // ⚠ Đổi các key này cho khớp với Amenity trong create-room-type.dto.ts của bạn
  amenities: string[];
}

const BASIC = ['wifi', 'air_conditioner', 'tv'];

export const ROOM_TYPES: RoomTypeSeed[] = [
  {
    name: 'Standard',
    base_price: 550_000,
    capacity: 2,
    bed_type: 'double',
    amenities: BASIC,
  },
  {
    name: 'Superior',
    base_price: 700_000,
    capacity: 2,
    bed_type: 'twin',
    amenities: [...BASIC, 'minibar'],
  },
  {
    name: 'Deluxe',
    base_price: 800_000,
    capacity: 2,
    bed_type: 'twin',
    amenities: [...BASIC, 'minibar', 'city_view'],
  },
  {
    name: 'Family',
    base_price: 1_200_000,
    capacity: 4,
    bed_type: 'queen',
    amenities: [...BASIC, 'minibar', 'bathtub'],
  },
  {
    name: 'Suite',
    base_price: 1_800_000,
    capacity: 2,
    bed_type: 'king',
    amenities: [...BASIC, 'minibar', 'bathtub', 'balcony', 'city_view'],
  },
  {
    name: 'President',
    base_price: 3_500_000,
    capacity: 2,
    bed_type: 'king',
    amenities: [
      ...BASIC,
      'minibar',
      'bathtub',
      'balcony',
      'city_view',
      'kitchen',
    ],
  },
];

/** Mỗi tầng một dòng, theo thứ tự phòng x01, x02, ... */
const LAYOUT: Record<number, string[]> = {
  1: ['Standard', 'Standard', 'Standard', 'Standard', 'Superior', 'Superior'],
  2: ['Standard', 'Standard', 'Superior', 'Superior', 'Deluxe', 'Deluxe'],
  3: ['Superior', 'Deluxe', 'Deluxe', 'Deluxe', 'Deluxe', 'Family'],
  4: ['Deluxe', 'Family', 'Family', 'Family', 'Suite', 'Suite'],
  5: ['Suite', 'Suite', 'Suite', 'President', 'President'],
};

export const ROOMS = Object.entries(LAYOUT).flatMap(([floor, types]) =>
  types.map((type, i) => ({
    number: `${floor}0${i + 1}`,
    floor: Number(floor),
    type,
  })),
); // 29 phòng: 101..106, 201..206, ..., 501..505

/** Phòng đang không kinh doanh: không nhận booking từ hôm nay trở đi */
export const BLOCKED_ROOMS: Record<
  string,
  { status: RoomStatus; by: string; daysAgo: number }
> = {
  '305': { status: 'maintenance', by: 'son', daysAgo: 1 }, // hỏng điều hoà
  '402': { status: 'maintenance', by: 'son', daysAgo: 3 }, // thấm trần
  '505': { status: 'inactive', by: 'admin', daysAgo: 10 }, // đang sửa lại nội thất
};

/** Trọng số chọn loại phòng khi sinh booking lịch sử */
export const TYPE_WEIGHTS: [string, number][] = [
  ['Standard', 30],
  ['Superior', 20],
  ['Deluxe', 25],
  ['Family', 10],
  ['Suite', 10],
  ['President', 5],
];

/* ============================ Dịch vụ ============================ */

export interface ServiceSeed {
  key: string;
  name: string;
  price: number;
  is_active?: boolean;
  /** Số lượng mỗi lần dùng: 'per_night' = theo số đêm (VD ăn sáng) */
  qty: [number, number] | 'per_night';
}

export const SERVICES: ServiceSeed[] = [
  {
    key: 'breakfast',
    name: 'Ăn sáng buffet',
    price: 150_000,
    qty: 'per_night',
  },
  { key: 'laundry', name: 'Giặt ủi (kg)', price: 50_000, qty: [1, 4] },
  { key: 'airport', name: 'Đưa đón sân bay', price: 350_000, qty: [1, 2] },
  { key: 'motorbike', name: 'Thuê xe máy (ngày)', price: 150_000, qty: [1, 3] },
  { key: 'water', name: 'Minibar - Nước suối', price: 20_000, qty: [1, 6] },
  { key: 'beer', name: 'Minibar - Bia', price: 35_000, qty: [1, 6] },
  { key: 'snack', name: 'Minibar - Snack', price: 30_000, qty: [1, 3] },
  { key: 'spa', name: 'Massage 60 phút', price: 450_000, qty: [1, 2] },
  {
    key: 'extra_bed',
    name: 'Phụ thu giường phụ',
    price: 300_000,
    qty: 'per_night',
  },
  { key: 'late_checkout', name: 'Trả phòng muộn', price: 200_000, qty: [1, 1] },
  {
    key: 'dry_clean',
    name: 'Giặt hấp',
    price: 80_000,
    qty: [1, 2],
    is_active: false,
  }, // ngưng cung cấp
];

/* ============================ Khách hàng ============================ */

export interface CustomerSeed {
  key: string;
  first: string; // Tên
  last: string; // Họ và tên đệm
  phone: string;
  email?: string;
  id_type?: IdType;
  id_card?: string;
  nationality: string;
  /** Có = thành viên (có tài khoản đăng nhập). Không có = khách vãng lai */
  member?: { joinedDaysAgo: number; locked?: boolean };
  /** Tần suất xuất hiện trong booking lịch sử. 0 = chưa từng ở */
  weight: number;
}

// Email thành viên dùng đuôi @example.com (tên miền dành riêng cho ví dụ, không ai nhận thư).
// Số điện thoại VN dùng dải 0911000xxx để không trùng dữ liệu bạn tự nhập.
export const CUSTOMERS: CustomerSeed[] = [
  // --- Thành viên, khách quen ---
  {
    key: 'khoa',
    first: 'Khoa',
    last: 'Trần Minh',
    phone: '0911000001',
    email: 'khoa.tran@example.com',
    id_type: 'cccd',
    id_card: '079203001234',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 400 },
    weight: 5,
  },
  {
    key: 'linh',
    first: 'Linh',
    last: 'Nguyễn Ngọc',
    phone: '0911000002',
    email: 'linh.nguyen@example.com',
    id_type: 'cccd',
    id_card: '001198004567',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 320 },
    weight: 4,
  },
  {
    key: 'phuc',
    first: 'Phúc',
    last: 'Lê Hoàng',
    phone: '0911000003',
    email: 'phuc.le@example.com',
    id_type: 'cccd',
    id_card: '048095012345',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 250 },
    weight: 3,
  },
  {
    key: 'thao',
    first: 'Thảo',
    last: 'Phạm Phương',
    phone: '0911000004',
    email: 'thao.pham@example.com',
    id_type: 'cccd',
    id_card: '079300078901',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 210 },
    weight: 3,
  },
  {
    key: 'quan',
    first: 'Quân',
    last: 'Võ Anh',
    phone: '0911000005',
    email: 'quan.vo@example.com',
    id_type: 'cccd',
    id_card: '052099003456',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 180, locked: true },
    weight: 1,
  },
  {
    key: 'vy',
    first: 'Vy',
    last: 'Huỳnh Tường',
    phone: '0911000006',
    email: 'vy.huynh@example.com',
    id_type: 'cccd',
    id_card: '079301045678',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 150 },
    weight: 2,
  },
  {
    key: 'nam',
    first: 'Nam',
    last: 'Đặng Hải',
    phone: '0911000007',
    email: 'nam.dang@example.com',
    id_type: 'cccd',
    id_card: '031096067890',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 120 },
    weight: 3,
  },
  {
    key: 'trang',
    first: 'Trang',
    last: 'Bùi Thu',
    phone: '0911000008',
    email: 'trang.bui@example.com',
    id_type: 'cccd',
    id_card: '036197089012',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 90 },
    weight: 2,
  },
  {
    key: 'emily',
    first: 'Emily',
    last: 'Nguyen',
    phone: '+14155550123',
    email: 'emily.nguyen@example.com',
    id_type: 'passport',
    id_card: '584219903',
    nationality: 'Hoa Kỳ',
    member: { joinedDaysAgo: 60 },
    weight: 1,
  },
  {
    key: 'tuananh',
    first: 'Anh',
    last: 'Nguyễn Tuấn',
    phone: '0911000009',
    email: 'tuananh.nguyen@example.com',
    nationality: 'Việt Nam',
    member: { joinedDaysAgo: 3 },
    weight: 0,
  }, // mới đăng ký, chưa ở lần nào

  // --- Khách vãng lai trong nước ---
  {
    key: 'duc',
    first: 'Đức',
    last: 'Hoàng Minh',
    phone: '0911000010',
    id_type: 'cccd',
    id_card: '079094023456',
    nationality: 'Việt Nam',
    weight: 3,
  },
  {
    key: 'hoa',
    first: 'Hoa',
    last: 'Lý Thị',
    phone: '0911000011',
    id_type: 'cccd',
    id_card: '046192034567',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'thanh',
    first: 'Thành',
    last: 'Trương Công',
    phone: '0911000012',
    id_type: 'cccd',
    id_card: '038090045678',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'yen',
    first: 'Yến',
    last: 'Mai Hải',
    phone: '0911000013',
    email: 'yen.mai@example.com',
    id_type: 'cccd',
    id_card: '079199056789',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'long',
    first: 'Long',
    last: 'Phan Bảo',
    phone: '0911000014',
    id_type: 'cccd',
    id_card: '075093067890',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'hieu',
    first: 'Hiếu',
    last: 'Dương Trung',
    phone: '0911000015',
    id_type: 'cccd',
    id_card: '060098078901',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'my',
    first: 'My',
    last: 'Châu Diễm',
    phone: '0911000016',
    email: 'my.chau@example.com',
    id_type: 'cccd',
    id_card: '092300089012',
    nationality: 'Việt Nam',
    weight: 1,
  },
  {
    key: 'tai',
    first: 'Tài',
    last: 'Lâm Đức',
    phone: '0911000017',
    id_type: 'cccd',
    id_card: '083091090123',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'binh',
    first: 'Bình',
    last: 'Hồ Thanh',
    phone: '0911000018',
    id_type: 'cccd',
    id_card: '066089001234',
    nationality: 'Việt Nam',
    weight: 2,
  },
  {
    key: 'an',
    first: 'An',
    last: 'Tạ Thuỳ',
    phone: '0911000019',
    id_type: 'cccd',
    id_card: '079302012345',
    nationality: 'Việt Nam',
    weight: 1,
  },
  // Gọi điện đặt trước, CHƯA có giấy tờ -> phải bổ sung lúc check-in
  {
    key: 'ngan',
    first: 'Ngân',
    last: 'Tô Kim',
    phone: '0911000020',
    nationality: 'Việt Nam',
    weight: 0,
  },
  {
    key: 'uyen',
    first: 'Uyên',
    last: 'Kiều Phương',
    phone: '0911000021',
    nationality: 'Việt Nam',
    weight: 0,
  },
  {
    key: 'hanh',
    first: 'Hạnh',
    last: 'Vũ Thị',
    phone: '0911000022',
    nationality: 'Việt Nam',
    weight: 0,
  },

  // --- Khách nước ngoài (hộ chiếu) ---
  {
    key: 'james',
    first: 'James',
    last: 'Carter',
    phone: '+447700900123',
    email: 'james.carter@example.com',
    id_type: 'passport',
    id_card: '533380006',
    nationality: 'Anh',
    weight: 1,
  },
  {
    key: 'sophie',
    first: 'Sophie',
    last: 'Martin',
    phone: '+33612345678',
    id_type: 'passport',
    id_card: '20FR45871',
    nationality: 'Pháp',
    weight: 1,
  },
  {
    key: 'kenji',
    first: 'Kenji',
    last: 'Tanaka',
    phone: '+819012345678',
    id_type: 'passport',
    id_card: 'TK4471289',
    nationality: 'Nhật Bản',
    weight: 2,
  },
  {
    key: 'minjun',
    first: 'Min-jun',
    last: 'Kim',
    phone: '+821012345678',
    id_type: 'passport',
    id_card: 'M72516634',
    nationality: 'Hàn Quốc',
    weight: 1,
  },
  {
    key: 'lukas',
    first: 'Lukas',
    last: 'Weber',
    phone: '+4915112345678',
    id_type: 'passport',
    id_card: 'C4F7X9K21',
    nationality: 'Đức',
    weight: 1,
  },
  {
    key: 'chen',
    first: 'Wei',
    last: 'Chen',
    phone: '+8613812345678',
    id_type: 'passport',
    id_card: 'E81234567',
    nationality: 'Trung Quốc',
    weight: 1,
  },
  {
    key: 'olivia',
    first: 'Olivia',
    last: 'Brown',
    phone: '+61412345678',
    id_type: 'passport',
    id_card: 'PA3918274',
    nationality: 'Úc',
    weight: 1,
  },
];

/* ============================ Booking kịch bản ============================ */

export interface ScriptedBooking {
  customer: string;
  /** Mỗi phần tử = 1 phòng, ghi tên loại phòng */
  rooms: string[];
  from: number; // lệch so với hôm nay
  to: number;
  status: BookingStatus;
  /**
   * online  = khách TỰ đặt bằng tài khoản -> chỉ dùng cho thành viên
   * walk_in = lễ tân tạo (tại quầy, hoặc khách gọi điện / gửi email)
   */
  type: BookingType;
  /** walk_in: lễ tân nào tạo. Bỏ trống = chọn ngẫu nhiên */
  by?: string;
  services?: [serviceKey: string, qty: number][];
  adults?: number;
  children?: number;
  note?: string;
  /** Chỉ dùng khi status = cancelled. by: key nhân viên, hoặc 'self' = khách tự huỷ */
  cancel?: { by: string; reason: string };
}

/**
 * Các booking "đang diễn ra" viết tay, để màn hình nào cũng có đủ trường hợp.
 * Booking lịch sử (đã trả phòng) thì sinh ngẫu nhiên, xem HISTORY_COUNT.
 */
export const SCRIPTED_BOOKINGS: ScriptedBooking[] = [
  // ----- Đang ở (checked_in) -> phòng "Có khách" -----
  {
    customer: 'khoa',
    rooms: ['Deluxe'],
    from: -2,
    to: 1,
    status: 'checked_in',
    type: 'online',
    adults: 2,
    services: [
      ['breakfast', 4],
      ['laundry', 2],
    ],
  },
  {
    customer: 'james',
    rooms: ['Suite'],
    from: -3,
    to: 2,
    status: 'checked_in',
    type: 'walk_in',
    by: 'mai',
    note: 'Đặt qua email, cần hoá đơn VAT',
    services: [
      ['airport', 1],
      ['spa', 1],
      ['beer', 4],
    ],
  },
  {
    customer: 'duc',
    rooms: ['Standard'],
    from: -1,
    to: 0,
    status: 'checked_in',
    type: 'walk_in',
    by: 'lan',
    services: [['water', 2]],
  }, // trả phòng hôm nay
  {
    customer: 'sophie',
    rooms: ['Family'],
    from: 0,
    to: 3,
    status: 'checked_in',
    type: 'walk_in',
    by: 'lan',
    adults: 2,
    children: 2,
    services: [['extra_bed', 3]],
  }, // vừa nhận phòng hôm nay
  {
    customer: 'linh',
    rooms: ['Superior', 'Superior'],
    from: -1,
    to: 2,
    status: 'checked_in',
    type: 'online',
    adults: 4,
    note: 'Đoàn 2 phòng, thanh toán chung',
    services: [['breakfast', 4]],
  },
  {
    customer: 'kenji',
    rooms: ['Deluxe'],
    from: -4,
    to: 1,
    status: 'checked_in',
    type: 'walk_in',
    by: 'mai',
    services: [
      ['motorbike', 3],
      ['laundry', 3],
    ],
  },
  {
    customer: 'thanh',
    rooms: ['Standard'],
    from: -1,
    to: 1,
    status: 'checked_in',
    type: 'walk_in',
    by: 'mai',
  },
  {
    customer: 'chen',
    rooms: ['President'],
    from: -2,
    to: 3,
    status: 'checked_in',
    type: 'walk_in',
    by: 'bang',
    adults: 2,
    services: [
      ['airport', 1],
      ['spa', 2],
    ],
  },

  // ----- Trả phòng sáng nay -> phòng "Đang dọn" -----
  {
    customer: 'yen',
    rooms: ['Standard'],
    from: -2,
    to: 0,
    status: 'checked_out',
    type: 'walk_in',
    by: 'lan',
    services: [['late_checkout', 1]],
  },
  {
    customer: 'nam',
    rooms: ['Superior'],
    from: -3,
    to: 0,
    status: 'checked_out',
    type: 'online',
    adults: 2,
    services: [
      ['breakfast', 3],
      ['snack', 2],
    ],
  },

  // ----- Sắp đến hôm nay (confirmed, check-in = hôm nay) -----
  {
    customer: 'hanh',
    rooms: ['Standard'],
    from: 0,
    to: 2,
    status: 'confirmed',
    type: 'walk_in',
    by: 'mai',
    note: 'Gọi điện đặt, đến khoảng 20h. Chưa có CCCD',
  },
  {
    customer: 'phuc',
    rooms: ['Deluxe'],
    from: 0,
    to: 3,
    status: 'confirmed',
    type: 'online',
    adults: 2,
  },
  {
    customer: 'minjun',
    rooms: ['Superior'],
    from: 0,
    to: 4,
    status: 'confirmed',
    type: 'walk_in',
    by: 'lan',
  },

  // ----- Sắp tới -----
  {
    customer: 'thao',
    rooms: ['Suite'],
    from: 2,
    to: 5,
    status: 'confirmed',
    type: 'online',
    adults: 2,
  },
  {
    customer: 'ngan',
    rooms: ['Standard'],
    from: 3,
    to: 4,
    status: 'confirmed',
    type: 'walk_in',
    by: 'lan',
    note: 'Đặt qua điện thoại, chưa có CCCD',
  },
  {
    customer: 'vy',
    rooms: ['Family'],
    from: 5,
    to: 8,
    status: 'confirmed',
    type: 'online',
    adults: 2,
    children: 1,
  },
  {
    customer: 'lukas',
    rooms: ['Deluxe'],
    from: 7,
    to: 10,
    status: 'confirmed',
    type: 'walk_in',
    by: 'mai',
  },
  {
    customer: 'emily',
    rooms: ['Suite'],
    from: 10,
    to: 14,
    status: 'confirmed',
    type: 'online',
  },
  {
    customer: 'trang',
    rooms: ['Deluxe'],
    from: 14,
    to: 16,
    status: 'confirmed',
    type: 'online',
    adults: 2,
  },
  {
    customer: 'olivia',
    rooms: ['Superior', 'Standard'],
    from: 20,
    to: 25,
    status: 'confirmed',
    type: 'walk_in',
    by: 'mai',
    adults: 3,
  },

  // ----- Chờ duyệt: thành viên tự đặt qua API, lễ tân chưa duyệt -----
  {
    customer: 'tuananh',
    rooms: ['Standard'],
    from: 6,
    to: 8,
    status: 'pending',
    type: 'online',
    adults: 2,
  },
  {
    customer: 'nam',
    rooms: ['Deluxe'],
    from: 12,
    to: 13,
    status: 'pending',
    type: 'online',
  },
  {
    customer: 'khoa',
    rooms: ['Suite'],
    from: 30,
    to: 32,
    status: 'pending',
    type: 'online',
    adults: 2,
    note: 'Kỷ niệm ngày cưới, xin phòng tầng cao',
  },

  // ----- Đã huỷ -----
  {
    customer: 'quan',
    rooms: ['Deluxe'],
    from: -20,
    to: -18,
    status: 'cancelled',
    type: 'online',
    cancel: { by: 'self', reason: 'Khách đổi kế hoạch' },
  },
  {
    customer: 'quan',
    rooms: ['Deluxe'],
    from: -9,
    to: -7,
    status: 'cancelled',
    type: 'online',
    cancel: { by: 'tuan', reason: 'Khách huỷ sát ngày đến' },
  },
  {
    customer: 'trang',
    rooms: ['Family'],
    from: 3,
    to: 5,
    status: 'cancelled',
    type: 'online',
    cancel: { by: 'lan', reason: 'Từ chối: hết phòng Family ngày khách chọn' },
  },
  {
    customer: 'long',
    rooms: ['Standard'],
    from: 4,
    to: 6,
    status: 'cancelled',
    type: 'walk_in',
    by: 'lan',
    cancel: { by: 'bang', reason: 'Khách gọi điện huỷ' },
  },
  {
    customer: 'hieu',
    rooms: ['Superior'],
    from: -8,
    to: -6,
    status: 'cancelled',
    type: 'walk_in',
    by: 'mai',
    cancel: { by: 'bang', reason: 'Khách đổi sang ngày khác' },
  },

  // ----- Không đến (no_show): qua ngày đến mà không check-in -----
  {
    customer: 'binh',
    rooms: ['Standard'],
    from: -3,
    to: -1,
    status: 'no_show',
    type: 'walk_in',
    by: 'lan',
    note: 'Gọi điện đặt',
  },
  {
    customer: 'an',
    rooms: ['Superior'],
    from: -2,
    to: 0,
    status: 'no_show',
    type: 'walk_in',
    by: 'mai',
  },
];

/* ============================ Ghi chú khách hàng ============================ */

export const CUSTOMER_NOTES: {
  customer: string;
  author: string;
  content: string;
  daysAgo: number;
}[] = [
  {
    customer: 'khoa',
    author: 'lan',
    content: 'Khách quen, thích phòng tầng cao và yên tĩnh.',
    daysAgo: 40,
  },
  {
    customer: 'khoa',
    author: 'bang',
    content: 'Đã tặng voucher ăn sáng cho lần ở tiếp theo.',
    daysAgo: 2,
  },
  {
    customer: 'james',
    author: 'mai',
    content: 'Cần hoá đơn VAT cho công ty, gửi email trước khi trả phòng.',
    daysAgo: 3,
  },
  {
    customer: 'chen',
    author: 'ha',
    content: 'Yêu cầu thêm gối, đã chuẩn bị sẵn trong phòng.',
    daysAgo: 2,
  },
  {
    customer: 'quan',
    author: 'bang',
    content: 'Khoá tài khoản do huỷ phòng nhiều lần sát ngày không báo trước.',
    daysAgo: 7,
  },
  {
    customer: 'ngan',
    author: 'lan',
    content:
      'Đặt qua điện thoại, chưa có CCCD. Nhắc khách mang giấy tờ khi nhận phòng.',
    daysAgo: 1,
  },
  {
    customer: 'hanh',
    author: 'mai',
    content: 'Đặt qua điện thoại, sẽ đến khoảng 20h. Giữ phòng.',
    daysAgo: 2,
  },
  {
    customer: 'linh',
    author: 'mai',
    content: 'Đoàn 2 phòng, thanh toán chung một hoá đơn.',
    daysAgo: 1,
  },
];
