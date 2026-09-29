import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  allowedActions,
  bookingCode,
  HOLDING_STATUSES,
  MAX_PENDING_PER_CUSTOMER,
  nightsBetween,
  quoteStay,
  type StayRange,
  toDate,
  todayYmd,
  toYmd,
  validateDates,
  validateGuests,
} from './booking.rules';
import { CreateBookingDto, CreateMyBookingDto } from './dto/create-booking.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { type BookingTab, QueryBookingDto } from './dto/quey-booking.dto';
import {
  BookingDetailDto,
  BookingListItemDto,
  BookingQuoteDto,
  BookingRoomDto,
  BookingStatsDto,
  BookingTimelineDto,
  PaginatedBookingResponseDto,
} from './dto/booking-response.dto';

/* ============================================================
 *  SELECT dùng chung. `satisfies` giữ kiểu literal -> Prisma suy ra đúng kiểu kết quả
 * ============================================================ */

const NAME = { select: { first_name: true, last_name: true } } as const;

const LIST_SELECT = {
  id: true,
  code: true,
  status: true,
  booking_type: true,
  check_in_date: true,
  check_out_date: true,
  adults: true,
  children: true,
  created_at: true,
  customer: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      phone: true,
      account_id: true,
    },
  },
  // UI chốt 1 booking = 1 phòng -> chỉ lấy phòng đầu tiên
  booking_rooms: {
    take: 1,
    select: {
      price_per_night: true,
      room: {
        select: {
          id: true,
          room_number: true,
          floor: true,
          room_type: { select: { name: true, capacity: true } },
        },
      },
    },
  },
  invoices: { select: { final_amount: true } },
} satisfies Prisma.BookingSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  note: true,
  updated_at: true,
  created_by: true,
  confirmed_at: true,
  actual_check_in: true,
  actual_check_out: true,
  cancelled_at: true,
  cancel_reason: true,
  customer: {
    select: { ...LIST_SELECT.customer.select, id_card: true },
  },
  creator: NAME,
  confirmer: NAME,
  check_in_staff: NAME,
  check_out_staff: NAME,
  // Người huỷ là Account: có thể là nhân viên hoặc chính khách
  canceller: { select: { employee: NAME, customer: NAME } },
  booking_services: {
    orderBy: { used_at: 'asc' },
    select: {
      id: true,
      quantity: true,
      unit_price: true,
      total_price: true,
      used_at: true,
      note: true,
      service: { select: { name: true } },
    },
  },
  invoices: {
    select: {
      id: true,
      status: true,
      total_amount: true,
      discount: true,
      final_amount: true,
      payments: {
        orderBy: { paid_at: 'asc' },
        select: {
          id: true,
          amount: true,
          payment_method: true,
          reference_number: true,
          paid_at: true,
          receiver: NAME,
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;

type ListRow = Prisma.BookingGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.BookingGetPayload<{ select: typeof DETAIL_SELECT }>;
type Db = Prisma.TransactionClient;

const ROOM_FOR_BOOKING = {
  id: true,
  room_number: true,
  floor: true,
  status: true,
  room_type: {
    select: { name: true, capacity: true, base_price: true, is_active: true },
  },
} satisfies Prisma.RoomSelect;

const fullName = (
  p: { first_name: string; last_name: string } | null | undefined,
) => (p ? `${p.last_name} ${p.first_name}`.trim() : null);

/** Tham số chung cho 2 đường tạo booking (nhân viên / khách) */
interface NewBooking {
  customerId: string;
  dto: CreateMyBookingDto;
  type: BookingType;
  status: Extract<BookingStatus, 'pending' | 'confirmed'>;
  employeeId: string | null;
  /** Nhân viên được biết booking nào đang chiếm phòng, khách thì không */
  revealConflict: boolean;
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ============================================================
   *  BÁO GIÁ: kiểm tra trước khi đặt, không ghi gì vào DB
   * ============================================================ */

  async quote(dto: QuoteBookingDto): Promise<BookingQuoteDto> {
    const range = { checkIn: dto.check_in_date, checkOut: dto.check_out_date };
    this.assertDates(range);

    const room = await this.loadBookableRoom(this.prisma, dto.room_id);
    this.assertGuests(dto, room.room_type.capacity);

    const conflict = await this.findConflictInDb(
      this.prisma,
      dto.room_id,
      range,
    );
    const price = Number(room.room_type.base_price);

    return {
      room: this.toRoomDto(room, price),
      check_in_date: range.checkIn,
      check_out_date: range.checkOut,
      ...quoteStay(price, range.checkIn, range.checkOut),
      available: !conflict,
    };
  }

  /* ============================================================
   *  TẠO BOOKING
   * ============================================================ */

  /** Lễ tân tạo (tại quầy / qua điện thoại) -> xác nhận luôn */
  async createByStaff(
    accountId: string,
    roles: string[],
    dto: CreateBookingDto,
  ): Promise<BookingDetailDto> {
    const employee = await this.employeeByAccount(accountId);

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customer_id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const id = await this.createBooking({
      customerId: customer.id,
      dto,
      type: 'walk_in',
      status: 'confirmed',
      employeeId: employee.id,
      revealConflict: true,
    });

    return this.findOne(id, roles);
  }

  /** Khách tự đặt online -> chờ lễ tân duyệt */
  async createByCustomer(
    accountId: string,
    dto: CreateMyBookingDto,
  ): Promise<BookingDetailDto> {
    const customerId = await this.customerIdByAccount(accountId);

    // Chặn giữ chỗ ảo: 1 khách tối đa N yêu cầu đang chờ
    const pending = await this.prisma.booking.count({
      where: { customer_id: customerId, status: 'pending' },
    });
    if (pending >= MAX_PENDING_PER_CUSTOMER) {
      throw new BadRequestException(
        `Bạn đang có ${pending} yêu cầu chờ duyệt. Vui lòng đợi khách sạn xác nhận trước khi đặt thêm`,
      );
    }

    const id = await this.createBooking({
      customerId,
      dto,
      type: 'online',
      status: 'pending',
      employeeId: null,
      revealConflict: false,
    });

    return this.findMyOne(accountId, id);
  }

  /**
   * Tạo booking trong 1 transaction có KHOÁ DÒNG PHÒNG.
   *
   * Vì sao cần khoá: 2 lễ tân cùng bấm đặt phòng 302 cho cùng ngày.
   *   Không khoá: cả 2 cùng kiểm tra "phòng trống" -> cả 2 cùng tạo -> trùng lịch.
   *   Có khoá:    người thứ 2 phải ĐỢI ở câu SELECT ... FOR UPDATE tới khi người 1 commit,
   *               lúc đó kiểm tra lại thì thấy booking của người 1 -> báo 409.
   * Khoá chỉ chặn các lượt đặt CÙNG phòng, phòng khác vẫn đặt song song bình thường.
   */
  private async createBooking(input: NewBooking): Promise<string> {
    const { dto } = input;
    const range = { checkIn: dto.check_in_date, checkOut: dto.check_out_date };
    this.assertDates(range);

    const created = await this.prisma.$transaction(
      async (tx) => {
        // 1. Khoá dòng phòng tới hết transaction
        await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${dto.room_id}::uuid FOR UPDATE`;

        // 2. Đọc + kiểm tra phòng SAU khi khoá -> không ai đổi được giữa chừng
        const room = await this.loadBookableRoom(tx, dto.room_id);
        this.assertGuests(dto, room.room_type.capacity);

        // 3. Kiểm tra trùng lịch
        const conflict = await this.findConflictInDb(tx, dto.room_id, range);
        if (conflict) {
          throw new ConflictException(
            input.revealConflict
              ? `Phòng ${room.room_number} đã có booking ${conflict.code} ` +
                  `(${toYmd(conflict.check_in_date)} → ${toYmd(conflict.check_out_date)})`
              : `Phòng ${room.room_number} vừa có người đặt trong khoảng ngày này, vui lòng chọn phòng khác`,
          );
        }

        // 4. Lấy số thứ tự. nextval không bị rollback: transaction lỗi thì mã bị nhảy số, không sao
        const [{ n }] = await tx.$queryRaw<
          { n: bigint }[]
        >`SELECT nextval('booking_code_seq') AS n`;
        const now = new Date();
        const confirmed = input.status === 'confirmed';

        return tx.booking.create({
          data: {
            code: bookingCode(now, n),
            customer_id: input.customerId,
            booking_type: input.type,
            status: input.status,
            check_in_date: toDate(range.checkIn),
            check_out_date: toDate(range.checkOut),
            adults: dto.adults ?? 1,
            children: dto.children ?? 0,
            note: dto.note?.trim() || null,
            created_at: now,
            created_by: input.employeeId,
            confirmed_by: confirmed ? input.employeeId : null,
            confirmed_at: confirmed ? now : null,
            booking_rooms: {
              // Chốt giá tại thời điểm đặt: sau này đổi giá loại phòng không ảnh hưởng booking cũ
              create: {
                room_id: room.id,
                price_per_night: room.room_type.base_price,
              },
            },
          },
          select: { id: true },
        });
      },
      // Neon ở xa, mặc định 5s đôi khi không đủ khi phải đợi khoá
      { maxWait: 5_000, timeout: 10_000 },
    );

    // Phòng vừa bị giữ -> kết quả "tìm phòng trống" cũ đã sai
    await this.redis.delByPattern('rooms:');
    return created.id;
  }

  /* ============================================================
   *  DANH SÁCH (nhân viên)
   * ============================================================ */

  async findAll(query: QueryBookingDto): Promise<PaginatedBookingResponseDto> {
    const {
      page = 1,
      limit = 20,
      tab = 'all',
      status,
      booking_type,
      search,
      from,
      to,
      sort,
      order,
    } = query;
    const today = todayYmd();

    if (from && to && from >= to) {
      throw new BadRequestException('"from" phải trước "to"');
    }

    const and: Prisma.BookingWhereInput[] = [this.tabWhere(tab, today)];

    if (status?.length) and.push({ status: { in: status } });
    if (booking_type) and.push({ booking_type });

    // Giao với [from, to): cùng công thức trùng lịch
    if (from) and.push({ check_out_date: { gt: toDate(from) } });
    if (to) and.push({ check_in_date: { lt: toDate(to) } });

    if (search?.trim()) {
      // "BK-2609 302" -> MỖI từ phải khớp ít nhất 1 field
      for (const token of search.trim().split(/\s+/).slice(0, 5)) {
        const compact = token.replace(/[\s.\-()]/g, '');
        and.push({
          OR: [
            { code: { contains: token, mode: 'insensitive' } },
            {
              customer: {
                first_name: { contains: token, mode: 'insensitive' },
              },
            },
            {
              customer: { last_name: { contains: token, mode: 'insensitive' } },
            },
            ...(compact
              ? [{ customer: { phone: { contains: compact } } }]
              : []),
            {
              booking_rooms: {
                some: { room: { room_number: { contains: token } } },
              },
            },
          ],
        });
      }
    }

    const where: Prisma.BookingWhereInput = { AND: and };
    const orderBy = this.orderFor(tab, sort, order);

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toListItem(r, today)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Điều kiện của từng tab. Thống kê (getStats) dùng CHÍNH hàm này
   * -> số trên tab luôn khớp số dòng khi bấm vào tab.
   */
  private tabWhere(tab: BookingTab, today: string): Prisma.BookingWhereInput {
    const t = toDate(today);
    switch (tab) {
      case 'pending':
        return { status: 'pending' };
      case 'arrivals':
        return { status: 'confirmed', check_in_date: { lte: t } };
      case 'in_house':
        return { status: 'checked_in' };
      case 'departures':
        return { status: 'checked_in', check_out_date: { lte: t } };
      case 'upcoming':
        return { status: 'confirmed', check_in_date: { gt: t } };
      case 'history':
        return { status: { in: ['checked_out', 'cancelled', 'no_show'] } };
      default:
        return {};
    }
  }

  /** Mỗi tab có thứ tự mặc định hợp lý nhất cho việc cần làm. Luôn thêm id để phân trang ổn định */
  private orderFor(
    tab: BookingTab,
    sort?: QueryBookingDto['sort'],
    order?: 'asc' | 'desc',
  ): Prisma.BookingOrderByWithRelationInput[] {
    const defaults: Record<
      BookingTab,
      [NonNullable<QueryBookingDto['sort']>, 'asc' | 'desc']
    > = {
      pending: ['created_at', 'asc'], // ai gửi trước duyệt trước
      arrivals: ['check_in_date', 'asc'], // khách trễ lên đầu
      in_house: ['check_out_date', 'asc'], // sắp đi lên đầu
      departures: ['check_out_date', 'asc'],
      upcoming: ['check_in_date', 'asc'],
      history: ['check_out_date', 'desc'],
      all: ['created_at', 'desc'],
    };
    const [field, dir] = defaults[tab];
    return [{ [sort ?? field]: order ?? dir }, { id: 'asc' }];
  }

  /* ============================================================
   *  THỐNG KÊ (số trên các tab + công suất phòng)
   * ============================================================ */

  async getStats(): Promise<BookingStatsDto> {
    const today = todayYmd();
    const t = toDate(today);
    const count = (where: Prisma.BookingWhereInput) =>
      this.prisma.booking.count({ where });

    const [
      pending,
      arrivals,
      arrivalsOverdue,
      inHouse,
      departures,
      departuresOverdue,
      upcoming,
      occupiedRooms,
      sellableRooms,
    ] = await Promise.all([
      count(this.tabWhere('pending', today)),
      count(this.tabWhere('arrivals', today)),
      count({ status: 'confirmed', check_in_date: { lt: t } }),
      count(this.tabWhere('in_house', today)),
      count(this.tabWhere('departures', today)),
      count({ status: 'checked_in', check_out_date: { lt: t } }),
      count(this.tabWhere('upcoming', today)),
      this.prisma.bookingRoom.count({
        where: { booking: { status: 'checked_in' } },
      }),
      // Phòng đang kinh doanh: bỏ phòng đã ẩn và đang bảo trì
      this.prisma.room.count({
        where: { status: { notIn: ['inactive', 'maintenance'] } },
      }),
    ]);

    return {
      pending,
      arrivals,
      arrivals_overdue: arrivalsOverdue,
      in_house: inHouse,
      departures,
      departures_overdue: departuresOverdue,
      upcoming,
      occupancy_rate: sellableRooms
        ? Math.round((occupiedRooms / sellableRooms) * 1000) / 10
        : 0,
    };
  }

  /* ============================================================
   *  CHI TIẾT
   * ============================================================ */

  async findOne(id: string, roles: string[]): Promise<BookingDetailDto> {
    const row = await this.prisma.booking.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy booking');
    return this.toDetail(row, roles, false);
  }

  /* ============================================================
   *  KHÁCH XEM BOOKING CỦA MÌNH
   * ============================================================ */

  async findMine(
    accountId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedBookingResponseDto> {
    const customerId = await this.customerIdByAccount(accountId);
    const where: Prisma.BookingWhereInput = { customer_id: customerId };

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ check_in_date: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const today = todayYmd();
    return {
      data: rows.map((r) => this.toListItem(r, today)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findMyOne(accountId: string, id: string): Promise<BookingDetailDto> {
    const customerId = await this.customerIdByAccount(accountId);
    // Lọc luôn theo customer_id: booking của người khác trả 404 như không tồn tại,
    // không trả 403 (403 = xác nhận là có booking đó)
    const row = await this.prisma.booking.findFirst({
      where: { id, customer_id: customerId },
      select: DETAIL_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy booking');
    return this.toDetail(row, ['customer'], true);
  }

  /* ============================================================
   *  HELPER KIỂM TRA
   * ============================================================ */

  private assertDates(range: StayRange) {
    const err = validateDates(range, todayYmd());
    if (err) throw new BadRequestException(err);
  }

  private assertGuests(
    dto: { adults?: number; children?: number },
    capacity: number,
  ) {
    const err = validateGuests(
      { adults: dto.adults ?? 1, children: dto.children ?? 0 },
      capacity,
    );
    if (err) throw new BadRequestException(err);
  }

  /** Phòng tồn tại, đang kinh doanh, loại phòng còn dùng */
  private async loadBookableRoom(db: Db, roomId: string) {
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: ROOM_FOR_BOOKING,
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if (room.status === 'inactive')
      throw new BadRequestException(
        `Phòng ${room.room_number} đã ngừng kinh doanh`,
      );
    if (room.status === 'maintenance')
      throw new BadRequestException(`Phòng ${room.room_number} đang bảo trì`);
    if (!room.room_type.is_active)
      throw new BadRequestException('Loại phòng này đã ngừng sử dụng');
    return room;
  }

  /**
   * Cùng luật với findConflict() trong booking.rules (đã có unit test),
   * viết thành điều kiện SQL để DB lọc thay vì kéo hết booking về.
   */
  private async findConflictInDb(db: Db, roomId: string, range: StayRange) {
    const hit = await db.bookingRoom.findFirst({
      where: {
        room_id: roomId,
        booking: {
          status: { in: [...HOLDING_STATUSES] },
          check_in_date: { lt: toDate(range.checkOut) },
          check_out_date: { gt: toDate(range.checkIn) },
        },
      },
      select: {
        booking: {
          select: { code: true, check_in_date: true, check_out_date: true },
        },
      },
    });
    return hit?.booking ?? null;
  }

  private async employeeByAccount(accountId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    // Tài khoản admin tạo tay có thể chưa có hồ sơ nhân viên -> không biết ghi ai là người tạo
    if (!employee)
      throw new ForbiddenException(
        'Tài khoản này chưa gắn với hồ sơ nhân viên',
      );
    return employee;
  }

  private async customerIdByAccount(accountId: string): Promise<string> {
    const c = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    return c.id;
  }

  /* ============================================================
   *  CHUYỂN DỮ LIỆU DB -> DTO
   * ============================================================ */

  private toRoomDto(
    room: {
      id: string;
      room_number: string;
      floor: number;
      room_type: { name: string; capacity: number };
    },
    price: number,
  ): BookingRoomDto {
    return {
      id: room.id,
      room_number: room.room_number,
      floor: room.floor,
      room_type: room.room_type.name,
      capacity: room.room_type.capacity,
      price_per_night: price,
    };
  }

  private toListItem(b: ListRow, today: string): BookingListItemDto {
    const checkIn = toYmd(b.check_in_date);
    const checkOut = toYmd(b.check_out_date);
    const nights = nightsBetween(checkIn, checkOut);
    const br = b.booking_rooms[0];
    const price = br ? Number(br.price_per_night) : 0;
    const invoice = b.invoices[0];

    const amount =
      b.status === 'cancelled' || b.status === 'no_show'
        ? 0
        : invoice
          ? Number(invoice.final_amount)
          : price * nights;

    return {
      id: b.id,
      code: b.code,
      status: b.status,
      booking_type: b.booking_type,
      check_in_date: checkIn,
      check_out_date: checkOut,
      nights,
      adults: b.adults,
      children: b.children,
      customer: {
        id: b.customer.id,
        full_name: fullName(b.customer)!,
        phone: b.customer.phone,
        is_member: b.customer.account_id !== null,
      },
      room: br ? this.toRoomDto(br.room, price) : null,
      amount,
      is_overdue:
        (b.status === 'confirmed' && checkIn < today) ||
        (b.status === 'checked_in' && checkOut < today),
      created_at: b.created_at,
    };
  }

  /** hideStaff = true khi khách xem: không lộ tên nhân viên */
  private toDetail(
    b: DetailRow,
    roles: string[],
    hideStaff: boolean,
  ): BookingDetailDto {
    const today = todayYmd();
    const base = this.toListItem(b, today);
    const staff = (p: { first_name: string; last_name: string } | null) =>
      hideStaff ? null : fullName(p);

    const services = b.booking_services.map((s) => ({
      id: s.id,
      name: s.service.name,
      quantity: s.quantity,
      unit_price: Number(s.unit_price),
      total_price: Number(s.total_price),
      used_at: s.used_at,
      note: s.note,
    }));

    const inv = b.invoices[0];
    const invoice = inv
      ? {
          id: inv.id,
          status: inv.status,
          total_amount: Number(inv.total_amount),
          discount: Number(inv.discount),
          final_amount: Number(inv.final_amount),
          paid_amount: inv.payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          ),
          payments: inv.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            payment_method: p.payment_method,
            reference_number: p.reference_number,
            paid_at: p.paid_at,
            received_by: staff(p.receiver),
          })),
        }
      : null;

    return {
      ...base,
      note: b.note,
      customer_has_id_card: !!b.customer.id_card,
      room_total: (base.room?.price_per_night ?? 0) * base.nights,
      service_total: services.reduce((sum, s) => sum + s.total_price, 0),
      services,
      invoice,
      timeline: this.buildTimeline(b, staff),
      allowed_actions: allowedActions(
        {
          status: b.status,
          checkIn: base.check_in_date,
          checkOut: base.check_out_date,
        },
        roles,
        today,
      ),
      updated_at: b.updated_at,
    };
  }

  private buildTimeline(
    b: DetailRow,
    staff: (
      p: { first_name: string; last_name: string } | null,
    ) => string | null,
  ): BookingTimelineDto[] {
    const events: BookingTimelineDto[] = [
      // creator null = khách tự đặt online
      {
        event: 'created',
        at: b.created_at,
        by: b.creator ? staff(b.creator) : fullName(b.customer),
      },
    ];

    // Nhân viên tạo thì đã xác nhận luôn cùng lúc -> không hiện thêm dòng "xác nhận" trùng lặp
    if (b.confirmed_at && !b.created_by) {
      events.push({
        event: 'confirmed',
        at: b.confirmed_at,
        by: staff(b.confirmer),
      });
    }
    if (b.actual_check_in) {
      events.push({
        event: 'checked_in',
        at: b.actual_check_in,
        by: staff(b.check_in_staff),
      });
    }
    if (b.actual_check_out) {
      events.push({
        event: 'checked_out',
        at: b.actual_check_out,
        by: staff(b.check_out_staff),
      });
    }
    if (b.status === 'cancelled' && b.cancelled_at) {
      const byEmployee = b.canceller?.employee ?? null;
      events.push({
        // Nhân viên huỷ đơn CHƯA từng được xác nhận = từ chối yêu cầu
        event: byEmployee && !b.confirmed_at ? 'rejected' : 'cancelled',
        at: b.cancelled_at,
        by: byEmployee ? staff(byEmployee) : fullName(b.canceller?.customer),
        ...(b.cancel_reason && { reason: b.cancel_reason }),
      });
    }
    if (b.status === 'no_show') {
      events.push({ event: 'no_show', at: b.updated_at, by: null });
    }

    return events.sort((x, y) => x.at.getTime() - y.at.getTime());
  }
}
