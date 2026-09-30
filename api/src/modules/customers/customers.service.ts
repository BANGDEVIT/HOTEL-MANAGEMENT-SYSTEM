import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, IdType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/s3/s3.service';
import {
  CreateGuestDto,
  normalizeIdCard,
  normalizePhone,
} from './dto/create-guest.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ChangePasswordDto } from './dto/chang-password-customer.dto';
import { LinkAccountDto } from './dto/link-account.dto';
import { LookupCustomerDto } from './dto/lookup-customer.dto';
import { QueryCustomerDto, StayStatus } from './dto/query-customers.dto';
import {
  CreateCustomerNoteDto,
  CustomerNoteDto,
} from './dto/customer-note.dto';
import {
  CustomerBookingDto,
  CustomerDetailDto,
  CustomerListItemDto,
  CustomerLookupDto,
  CustomerStatsDto,
  PaginatedCustomerResponseDto,
} from './dto/customer-response.dto';

/* ============================================================
 *  HẰNG SỐ + KIỂU
 * ============================================================ */

const HOTEL_TZ = 'Asia/Ho_Chi_Minh';

/** Booking được tính là "đã ở": đang ở hoặc đã trả phòng */
const STAYED: BookingStatus[] = ['checked_in', 'checked_out'];
/** Booking chưa tới: chờ xác nhận hoặc đã xác nhận */
const UPCOMING: BookingStatus[] = ['pending', 'confirmed'];

const MANAGER_ROLES = ['admin', 'manager'];

/** Ảnh giấy tờ gửi kèm (tên field khớp FileFieldsInterceptor ở controller) */
export type IdImageFiles = {
  front_image?: Express.Multer.File[];
  back_image?: Express.Multer.File[];
};

/**
 * Khai báo select 1 lần ở ngoài class.
 * "satisfies" giúp TypeScript vừa kiểm tra đúng cú pháp Prisma,
 * vừa suy ra đúng kiểu kết quả qua Prisma.CustomerGetPayload.
 */
const LIST_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
  id_type: true,
  id_card: true,
  nationality: true,
  source: true,
  reward_points: true,
  created_at: true,
  registered_at: true,
  account_id: true,
  account: { select: { is_active: true } },
} satisfies Prisma.CustomerSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  id_card_img_url: true,
  id_card_img_back_url: true,
  updated_at: true,
  account: { select: { id: true, email: true, is_active: true } },
} satisfies Prisma.CustomerSelect;

type ListRow = Prisma.CustomerGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.CustomerGetPayload<{ select: typeof DETAIL_SELECT }>;

interface StayInfo {
  stays: number;
  last_stay_at: string | null;
  stay_status: StayStatus;
  current_rooms: string[];
  next_arrival: string | null;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /* ============================================================
   *  HELPER THỜI GIAN
   * ============================================================ */

  /** "Hôm nay" theo giờ VN, dạng "2026-09-27" */
  private todayYmd(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: HOTEL_TZ });
  }

  /** Hôm nay dưới dạng Date 00:00 UTC, khớp cột @db.Date */
  private today(): Date {
    return new Date(`${this.todayYmd()}T00:00:00Z`);
  }

  private ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /* ============================================================
   *  DANH SÁCH
   * ============================================================ */

  async findAll(
    query: QueryCustomerDto,
  ): Promise<PaginatedCustomerResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      nationality,
      membership,
      stay,
      sort = 'created_at',
      order = 'desc',
    } = query;

    // Gom mọi điều kiện vào AND -> thêm/bớt điều kiện không đụng nhau
    const and: Prisma.CustomerWhereInput[] = [];

    if (nationality) {
      and.push({ nationality: { equals: nationality, mode: 'insensitive' } });
    }

    // Thành viên = CÓ tài khoản. KHÔNG lọc theo source:
    // khách vãng lai liên kết tài khoản rồi vẫn có source = walk_in
    if (membership === 'member') and.push({ account_id: { not: null } });
    if (membership === 'guest') and.push({ account_id: null });

    if (search?.trim()) {
      // "Trần 0909" -> ["Trần", "0909"]: MỖI từ phải khớp ít nhất 1 field
      const tokens = search.trim().split(/\s+/).slice(0, 5);
      for (const token of tokens) {
        const compact = token.replace(/[\s.\-()]/g, '');
        and.push({
          OR: [
            { first_name: { contains: token, mode: 'insensitive' } },
            { last_name: { contains: token, mode: 'insensitive' } },
            { email: { contains: token, mode: 'insensitive' } },
            { phone: { contains: compact } },
            { id_card: { contains: compact.toUpperCase() } },
          ],
        });
      }
    }

    if (stay?.length) {
      and.push({ OR: stay.map((s) => this.stayWhere(s)) });
    }

    const where: Prisma.CustomerWhereInput = and.length ? { AND: and } : {};

    // Luôn thêm id làm tiêu chí phụ: 2 dòng bằng nhau thì thứ tự vẫn cố định,
    // chuyển trang không bị lặp / sót dòng
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] = {
      created_at: [{ created_at: order }],
      name: [{ first_name: order }, { last_name: order }],
      reward_points: [{ reward_points: order }],
      stays: [{ bookings: { _count: order } }],
    }[sort];
    orderBy.push({ id: 'asc' });

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: LIST_SELECT,
      }),
      this.prisma.customer.count({ where }),
    ]);

    const info = await this.stayInfo(rows.map((r) => r.id));

    return {
      data: rows.map((r) => this.toListItem(r, info.get(r.id)!)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Điều kiện Prisma cho từng tình trạng lưu trú */
  private stayWhere(status: StayStatus): Prisma.CustomerWhereInput {
    const inHouse: Prisma.BookingWhereInput = { status: 'checked_in' };
    const arriving: Prisma.BookingWhereInput = {
      status: { in: UPCOMING },
      check_in_date: { gte: this.today() },
    };

    if (status === 'in_house') return { bookings: { some: inHouse } };
    if (status === 'arriving') {
      // Sắp đến = có booking sắp tới VÀ hiện KHÔNG đang ở
      return { bookings: { some: arriving, none: inHouse } };
    }
    return { bookings: { none: { OR: [inHouse, arriving] } } };
  }

  /**
   * Số lần ở, lần gần nhất, tình trạng lưu trú cho một nhóm khách.
   * Chạy 2 query cho CẢ trang (không phải 2 query mỗi khách):
   * 20 khách/trang -> vẫn chỉ 2 query.
   */
  private async stayInfo(ids: string[]): Promise<Map<string, StayInfo>> {
    const map = new Map<string, StayInfo>();
    for (const id of ids) {
      map.set(id, {
        stays: 0,
        last_stay_at: null,
        stay_status: 'none',
        current_rooms: [],
        next_arrival: null,
      });
    }
    if (ids.length === 0) return map;

    const [aggregates, active] = await Promise.all([
      // GROUP BY customer_id: đếm số lần ở + ngày nhận phòng gần nhất
      this.prisma.booking.groupBy({
        by: ['customer_id'],
        where: { customer_id: { in: ids }, status: { in: STAYED } },
        _count: { _all: true },
        _max: { check_in_date: true },
      }),
      // Booking đang ở hoặc sắp tới
      this.prisma.booking.findMany({
        where: {
          customer_id: { in: ids },
          OR: [
            { status: 'checked_in' },
            { status: { in: UPCOMING }, check_in_date: { gte: this.today() } },
          ],
        },
        select: {
          customer_id: true,
          status: true,
          check_in_date: true,
          booking_rooms: {
            select: { room: { select: { room_number: true } } },
          },
        },
        orderBy: { check_in_date: 'asc' },
      }),
    ]);

    for (const a of aggregates) {
      const info = map.get(a.customer_id)!;
      info.stays = a._count._all;
      info.last_stay_at = a._max.check_in_date
        ? this.ymd(a._max.check_in_date)
        : null;
    }

    for (const b of active) {
      const info = map.get(b.customer_id)!;
      if (b.status === 'checked_in') {
        info.stay_status = 'in_house';
        info.current_rooms.push(
          ...b.booking_rooms.map((br) => br.room.room_number),
        );
      } else {
        // Đã sắp xếp theo ngày tăng dần -> lần gán đầu tiên là ngày đến gần nhất
        info.next_arrival ??= this.ymd(b.check_in_date);
      }
    }

    for (const info of map.values()) {
      if (info.stay_status === 'none' && info.next_arrival)
        info.stay_status = 'arriving';
    }

    return map;
  }

  private toListItem(r: ListRow, info: StayInfo): CustomerListItemDto {
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      full_name: `${r.last_name} ${r.first_name}`,
      phone: r.phone,
      email: r.email,
      id_type: r.id_type,
      // Danh sách CHỈ trả 4 ký tự cuối. FE che thì vẫn đọc được số thật trong tab Network.
      id_card_last4: r.id_card ? r.id_card.slice(-4) : null,
      nationality: r.nationality,
      source: r.source,
      is_member: r.account_id !== null,
      member_since: r.registered_at,
      account_active: r.account?.is_active ?? null,
      reward_points: r.reward_points,
      created_at: r.created_at,
      ...info,
    };
  }

  /* ============================================================
   *  CHI TIẾT
   * ============================================================ */

  async findById(id: string): Promise<CustomerDetailDto> {
    const row = await this.prisma.customer.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    return this.toDetail(row);
  }

  private async toDetail(r: DetailRow): Promise<CustomerDetailDto> {
    const [info, paid] = await Promise.all([
      this.stayInfo([r.id]),
      // Tổng chi = tiền ĐÃ THU thật, không phải tổng hoá đơn (có hoá đơn chưa trả)
      this.prisma.payment.aggregate({
        where: { invoice: { booking: { customer_id: r.id } }, voided_at: null }, // phiếu đã huỷ không tính
        _sum: { amount: true },
      }),
    ]);

    return {
      ...this.toListItem(r, info.get(r.id)!),
      id_card: r.id_card,
      id_card_img_url: r.id_card_img_url,
      id_card_img_back_url: r.id_card_img_back_url,
      account: r.account,
      total_spent: Number(paid._sum.amount ?? 0), // Decimal -> number
      updated_at: r.updated_at,
    };
  }

  async getBookings(customerId: string): Promise<CustomerBookingDto[]> {
    await this.ensureExists(customerId);

    const rows = await this.prisma.booking.findMany({
      where: { customer_id: customerId },
      orderBy: { check_in_date: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        check_in_date: true,
        check_out_date: true,
        booking_rooms: {
          select: {
            price_per_night: true,
            room: {
              select: {
                room_number: true,
                room_type: { select: { name: true } },
              },
            },
          },
        },
        invoices: { select: { final_amount: true } },
      },
    });

    return rows.map((b) => {
      const nights = Math.max(
        1,
        Math.round(
          (b.check_out_date.getTime() - b.check_in_date.getTime()) / 86_400_000,
        ),
      );
      const invoiceTotal = b.invoices.reduce(
        (sum, inv) => sum + Number(inv.final_amount),
        0,
      );
      const roomTotal = b.booking_rooms.reduce(
        (sum, br) => sum + Number(br.price_per_night) * nights,
        0,
      );

      return {
        id: b.id,
        status: b.status,
        check_in_date: this.ymd(b.check_in_date),
        check_out_date: this.ymd(b.check_out_date),
        nights,
        rooms: b.booking_rooms.map((br) => ({
          room_number: br.room.room_number,
          room_type: br.room.room_type.name,
        })),
        // Đã huỷ thì 0. Có hoá đơn thì lấy hoá đơn, chưa có thì ước tính theo giá phòng.
        amount:
          b.status === 'cancelled'
            ? 0
            : b.invoices.length
              ? invoiceTotal
              : roomTotal,
      };
    });
  }

  /* ============================================================
   *  THỐNG KÊ
   * ============================================================ */

  async getStats(): Promise<CustomerStatsDto> {
    const [y, m] = this.todayYmd().split('-').map(Number);
    // Đầu tháng theo giờ VN. created_at là thời điểm (có giờ) -> gắn +07:00
    const monthStart = new Date(
      `${y}-${String(m).padStart(2, '0')}-01T00:00:00+07:00`,
    );
    const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
    const prevMonthStart = new Date(
      `${prev.y}-${String(prev.m).padStart(2, '0')}-01T00:00:00+07:00`,
    );

    const [
      total,
      members,
      inHouse,
      arrivingToday,
      newThis,
      newPrev,
      stayed,
      returning,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { account_id: { not: null } } }),
      this.prisma.customer.count({
        where: { bookings: { some: { status: 'checked_in' } } },
      }),
      this.prisma.customer.count({
        where: {
          bookings: {
            some: { status: { in: UPCOMING }, check_in_date: this.today() },
          },
        },
      }),
      this.prisma.customer.count({
        where: { created_at: { gte: monthStart } },
      }),
      this.prisma.customer.count({
        where: { created_at: { gte: prevMonthStart, lt: monthStart } },
      }),
      // Số khách đã ở ít nhất 1 lần
      this.prisma.booking.groupBy({
        by: ['customer_id'],
        where: { status: { in: STAYED } },
      }),
      // Số khách đã ở từ 2 lần: HAVING COUNT(*) >= 2
      this.prisma.booking.groupBy({
        by: ['customer_id'],
        where: { status: { in: STAYED } },
        having: { customer_id: { _count: { gte: 2 } } },
      }),
    ]);

    return {
      total,
      members,
      guests: total - members,
      in_house: inHouse,
      arriving_today: arrivingToday,
      new_this_month: newThis,
      new_last_month: newPrev,
      returning_rate: stayed.length
        ? Math.round((returning.length / stayed.length) * 100)
        : 0,
    };
  }

  /* ============================================================
   *  KIỂM TRA TRÙNG
   * ============================================================ */

  async lookup(dto: LookupCustomerDto): Promise<CustomerLookupDto[]> {
    const phone = dto.phone ? (normalizePhone(dto.phone) as string) : undefined;
    const idCard = dto.id_card
      ? (normalizeIdCard(dto.id_card) as string)
      : undefined;
    // Gõ dở vài số thì chưa tra, tránh báo trùng lung tung
    const usePhone = !!phone && phone.length >= 9;
    const useIdCard = !!idCard && idCard.length >= 6;
    if (!usePhone && !useIdCard) return [];

    const or: Prisma.CustomerWhereInput[] = [];
    if (usePhone) or.push({ phone });
    if (useIdCard) or.push({ id_card: idCard });

    const rows = await this.prisma.customer.findMany({
      where: { OR: or, ...(dto.exclude_id && { id: { not: dto.exclude_id } }) },
      take: 5,
      select: LIST_SELECT,
    });

    const info = await this.stayInfo(rows.map((r) => r.id));

    return rows.map((r) => ({
      ...this.toListItem(r, info.get(r.id)!),
      matched_by: [
        ...(usePhone && r.phone === phone ? (['phone'] as const) : []),
        ...(useIdCard && r.id_card === idCard ? (['id_card'] as const) : []),
      ],
    }));
  }

  /**
   * Chặn trùng khi tạo / sửa.
   * - Số giấy tờ: KHÔNG BAO GIỜ được trùng.
   * - SĐT: được trùng nếu nhân viên xác nhận (người nhà dùng chung số).
   */
  private async assertNoDuplicate(opts: {
    phone?: string;
    idCard?: string | null;
    excludeId?: string;
    allowDuplicatePhone?: boolean;
  }) {
    const notSelf: Prisma.CustomerWhereInput = opts.excludeId
      ? { id: { not: opts.excludeId } }
      : {};

    if (opts.idCard) {
      const dup = await this.prisma.customer.findFirst({
        where: { id_card: opts.idCard, ...notSelf },
        select: { first_name: true, last_name: true },
      });
      if (dup) {
        throw new ConflictException(
          `Số giấy tờ này đã thuộc hồ sơ khách ${dup.last_name} ${dup.first_name}`,
        );
      }
    }

    if (opts.phone && !opts.allowDuplicatePhone) {
      const dup = await this.prisma.customer.findFirst({
        where: { phone: opts.phone, ...notSelf },
        select: { first_name: true, last_name: true },
      });
      if (dup) {
        throw new ConflictException(
          `Số điện thoại này đã có hồ sơ khách ${dup.last_name} ${dup.first_name}`,
        );
      }
    }
  }

  /** CCCD phải 12 số; có số giấy tờ thì phải chọn loại */
  private assertIdentity(idType?: IdType | null, idCard?: string | null) {
    if (!idCard) return;
    if (!idType) {
      throw new BadRequestException('Chọn loại giấy tờ (CCCD hoặc hộ chiếu)');
    }
    if (idType === 'cccd' && !/^\d{12}$/.test(idCard)) {
      throw new BadRequestException('Số CCCD gồm đúng 12 chữ số');
    }
  }

  /* ============================================================
   *  TẠO KHÁCH VÃNG LAI
   * ============================================================ */

  async createGuest(
    dto: CreateGuestDto,
    files?: IdImageFiles,
  ): Promise<CustomerDetailDto> {
    // Chuẩn hoá lại ở service: phòng khi ValidationPipe tắt transform
    const phone = normalizePhone(dto.phone) as string;
    const idCard = dto.id_card
      ? (normalizeIdCard(dto.id_card) as string)
      : undefined;

    // Kiểm tra hết TRƯỚC khi upload: sai thì khỏi tốn công đẩy ảnh lên S3
    this.assertIdentity(dto.id_type, idCard);
    await this.assertNoDuplicate({
      phone,
      idCard,
      allowDuplicatePhone: dto.allow_duplicate_phone,
    });

    const uploaded = await this.uploadIdImages(files);

    try {
      const created = await this.prisma.customer.create({
        data: {
          first_name: dto.first_name,
          last_name: dto.last_name,
          phone,
          email: dto.email,
          id_type: dto.id_type,
          id_card: idCard,
          nationality: dto.nationality,
          id_card_img_url: uploaded.front,
          id_card_img_back_url: uploaded.back,
          source: 'walk_in',
        },
        select: { id: true },
      });
      return this.findById(created.id);
    } catch (err) {
      // Lưu DB lỗi -> xoá ảnh vừa upload, không để rác trên S3
      await this.deleteFiles([uploaded.front, uploaded.back]);
      throw err;
    }
  }

  /* ============================================================
   *  NHÂN VIÊN SỬA HỒ SƠ KHÁCH
   * ============================================================ */

  async update(
    id: string,
    dto: UpdateCustomerDto,
    files: IdImageFiles | undefined,
    actorRoles: string[],
  ): Promise<CustomerDetailDto> {
    const current = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        account_id: true,
        email: true,
        id_type: true,
        id_card: true,
        id_card_img_url: true,
        id_card_img_back_url: true,
      },
    });
    if (!current) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    // ----- 1. Quyền -----
    const isManager = actorRoles.some((r) => MANAGER_ROLES.includes(r));
    if (
      (dto.reward_points !== undefined || dto.is_active !== undefined) &&
      !isManager
    ) {
      throw new ForbiddenException(
        'Chỉ quản lý được sửa điểm thưởng hoặc khoá tài khoản',
      );
    }

    // ----- 2. Nghiệp vụ -----
    if (dto.is_active !== undefined && !current.account_id) {
      throw new BadRequestException(
        'Khách vãng lai không có tài khoản để khoá',
      );
    }
    // Email của khách thành viên là email ĐĂNG NHẬP -> nhân viên không được đổi hộ
    if (
      dto.email !== undefined &&
      current.account_id &&
      dto.email !== current.email
    ) {
      throw new BadRequestException(
        'Email của khách thành viên là email đăng nhập, khách phải tự đổi trong tài khoản',
      );
    }

    const phone = dto.phone ? (normalizePhone(dto.phone) as string) : undefined;
    const idCard = dto.id_card
      ? (normalizeIdCard(dto.id_card) as string)
      : undefined;

    // Kiểm tra trên giá trị SAU khi gộp: có thể chỉ gửi 1 trong 2 field id_type / id_card
    this.assertIdentity(
      dto.id_type ?? current.id_type,
      idCard ?? current.id_card,
    );
    await this.assertNoDuplicate({
      phone,
      idCard,
      excludeId: id,
      allowDuplicatePhone: dto.allow_duplicate_phone,
    });

    // ----- 3. Upload ảnh mới (ảnh cũ vẫn còn nguyên) -----
    const uploaded = await this.uploadIdImages(files);

    // ----- 4. Lưu DB: account + customer cùng thành công hoặc cùng thất bại -----
    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.is_active !== undefined) {
          await tx.account.update({
            where: { id: current.account_id! }, // đã kiểm tra != null ở bước 2
            data: { is_active: dto.is_active },
          });
        }

        await tx.customer.update({
          where: { id },
          data: {
            ...(dto.first_name !== undefined && { first_name: dto.first_name }),
            ...(dto.last_name !== undefined && { last_name: dto.last_name }),
            ...(phone !== undefined && { phone }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.id_type !== undefined && { id_type: dto.id_type }),
            ...(idCard !== undefined && { id_card: idCard }),
            ...(dto.nationality !== undefined && {
              nationality: dto.nationality,
            }),
            ...(dto.reward_points !== undefined && {
              reward_points: dto.reward_points,
            }),
            ...(uploaded.front && { id_card_img_url: uploaded.front }),
            ...(uploaded.back && { id_card_img_back_url: uploaded.back }),
          },
        });
      });
    } catch (err) {
      await this.deleteFiles([uploaded.front, uploaded.back]);
      throw err;
    }

    // ----- 5. DB đã trỏ sang ảnh mới rồi mới xoá ảnh cũ -----
    await this.deleteFiles([
      uploaded.front ? current.id_card_img_url : null,
      uploaded.back ? current.id_card_img_back_url : null,
    ]);

    return this.findById(id);
  }

  /* ============================================================
   *  KHÁCH TỰ XEM / SỬA HỒ SƠ
   * ============================================================ */

  private async customerIdByAccount(accountId: string): Promise<string> {
    const c = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    if (!c) {
      throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    }
    return c.id;
  }

  async getProfile(accountId: string): Promise<CustomerDetailDto> {
    return this.findById(await this.customerIdByAccount(accountId));
  }

  async updateProfile(
    accountId: string,
    dto: UpdateCustomerProfileDto,
    files?: IdImageFiles,
  ): Promise<CustomerDetailDto> {
    const current = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
      select: {
        id: true,
        email: true,
        id_type: true,
        id_card: true,
        id_card_img_url: true,
        id_card_img_back_url: true,
      },
    });
    if (!current) {
      throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    }

    const phone = dto.phone ? (normalizePhone(dto.phone) as string) : undefined;
    const idCard = dto.id_card
      ? (normalizeIdCard(dto.id_card) as string)
      : undefined;

    this.assertIdentity(
      dto.id_type ?? current.id_type,
      idCard ?? current.id_card,
    );
    // Khách tự sửa: không được trùng giấy tờ với người khác, SĐT thì cho phép
    await this.assertNoDuplicate({
      idCard,
      excludeId: current.id,
      allowDuplicatePhone: true,
    });

    const emailChanged = dto.email !== undefined && dto.email !== current.email;
    if (emailChanged) {
      const taken = await this.prisma.account.findUnique({
        where: { email: dto.email },
      });
      if (taken && taken.id !== accountId) {
        throw new ConflictException('Email đã được dùng cho tài khoản khác');
      }
    }

    const uploaded = await this.uploadIdImages(files);

    try {
      // Email nằm ở CẢ Account (đăng nhập) và Customer -> đổi cả 2 trong 1 transaction
      await this.prisma.$transaction(async (tx) => {
        if (emailChanged) {
          await tx.account.update({
            where: { id: accountId },
            data: { email: dto.email },
          });
        }
        await tx.customer.update({
          where: { id: current.id },
          data: {
            ...(dto.first_name !== undefined && { first_name: dto.first_name }),
            ...(dto.last_name !== undefined && { last_name: dto.last_name }),
            ...(phone !== undefined && { phone }),
            ...(emailChanged && { email: dto.email }),
            ...(dto.id_type !== undefined && { id_type: dto.id_type }),
            ...(idCard !== undefined && { id_card: idCard }),
            ...(dto.nationality !== undefined && {
              nationality: dto.nationality,
            }),
            ...(uploaded.front && { id_card_img_url: uploaded.front }),
            ...(uploaded.back && { id_card_img_back_url: uploaded.back }),
          },
        });
      });
    } catch (err) {
      await this.deleteFiles([uploaded.front, uploaded.back]);
      throw err;
    }

    await this.deleteFiles([
      uploaded.front ? current.id_card_img_url : null,
      uploaded.back ? current.id_card_img_back_url : null,
    ]);

    return this.findById(current.id);
  }

  async changePassword(
    accountId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const { current_password, new_password } = dto;

    if (current_password === new_password) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { hash_password: true },
    });
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const matched = await bcrypt.compare(
      current_password,
      account.hash_password,
    );
    if (!matched) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { hash_password: await bcrypt.hash(new_password, 10) },
    });
  }

  /* ============================================================
   *  LIÊN KẾT TÀI KHOẢN CHO KHÁCH VÃNG LAI
   * ============================================================ */

  async linkAccount(
    customerId: string,
    dto: LinkAccountDto,
  ): Promise<{ message: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { account_id: true, email: true },
    });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    if (customer.account_id) {
      throw new BadRequestException('Khách này đã có tài khoản');
    }

    const existing = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được dùng cho tài khoản khác');
    }

    const customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });
    if (!customerRole) {
      // Thiếu dữ liệu nền (chưa chạy seed) -> lỗi cấu hình, không phải lỗi của người dùng
      throw new InternalServerErrorException(
        'Chưa có role customer trong hệ thống',
      );
    }

    const hash = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          email: dto.email,
          hash_password: hash,
          role_account: { create: { role_id: customerRole.id } },
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: {
          account_id: account.id,
          registered_at: new Date(),
          // Hồ sơ chưa có email thì lấy luôn email đăng nhập
          ...(!customer.email && { email: dto.email }),
          // source GIỮ NGUYÊN walk_in: nó cho biết khách được tạo ở đâu, không phải trạng thái
        },
      });
    });

    return { message: 'Đã liên kết tài khoản' };
  }

  /* ============================================================
   *  GHI CHÚ NỘI BỘ
   * ============================================================ */

  async listNotes(customerId: string): Promise<CustomerNoteDto[]> {
    await this.ensureExists(customerId);

    const notes = await this.prisma.customerNote.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        content: true,
        created_at: true,
        author: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    return notes.map((n) => this.toNote(n));
  }

  async addNote(
    customerId: string,
    accountId: string,
    dto: CreateCustomerNoteDto,
  ): Promise<CustomerNoteDto> {
    await this.ensureExists(customerId);

    const author = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    if (!author) {
      throw new ForbiddenException('Chỉ nhân viên được viết ghi chú');
    }

    const note = await this.prisma.customerNote.create({
      data: {
        customer_id: customerId,
        author_id: author.id,
        content: dto.content,
      },
      select: {
        id: true,
        content: true,
        created_at: true,
        author: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    return this.toNote(note);
  }

  /** Người viết hoặc quản lý mới được xoá ghi chú */
  async deleteNote(
    customerId: string,
    noteId: string,
    accountId: string,
    actorRoles: string[],
  ): Promise<void> {
    const note = await this.prisma.customerNote.findFirst({
      // Kiểm tra cả customer_id: không xoá được ghi chú của khách khác bằng cách đổi URL
      where: { id: noteId, customer_id: customerId },
      select: { author: { select: { account_id: true } } },
    });
    if (!note) {
      throw new NotFoundException('Không tìm thấy ghi chú');
    }

    const isManager = actorRoles.some((r) => MANAGER_ROLES.includes(r));
    if (!isManager && note.author.account_id !== accountId) {
      throw new ForbiddenException(
        'Chỉ người viết hoặc quản lý được xoá ghi chú này',
      );
    }

    await this.prisma.customerNote.delete({ where: { id: noteId } });
  }

  private toNote(n: {
    id: string;
    content: string;
    created_at: Date;
    author: { id: string; first_name: string; last_name: string };
  }): CustomerNoteDto {
    return {
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      author: {
        id: n.author.id,
        full_name: `${n.author.last_name} ${n.author.first_name}`,
      },
    };
  }

  /* ============================================================
   *  HELPER CHUNG
   * ============================================================ */

  private async ensureExists(customerId: string) {
    const found = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
  }

  /** Upload ảnh giấy tờ. Ảnh thứ 2 lỗi thì xoá luôn ảnh thứ nhất đã lên */
  private async uploadIdImages(
    files?: IdImageFiles,
  ): Promise<{ front?: string; back?: string }> {
    const result: { front?: string; back?: string } = {};
    try {
      if (files?.front_image?.[0]) {
        result.front = await this.s3Service.uploadFile(
          files.front_image[0],
          'customers/id-cards',
        );
      }
      if (files?.back_image?.[0]) {
        result.back = await this.s3Service.uploadFile(
          files.back_image[0],
          'customers/id-cards',
        );
      }
      return result;
    } catch {
      await this.deleteFiles([result.front, result.back]);
      throw new InternalServerErrorException('Tải ảnh giấy tờ lên thất bại');
    }
  }

  /** Xoá nhiều file, bỏ qua giá trị rỗng, lỗi thì nuốt (file rác không đáng làm hỏng request) */
  private async deleteFiles(urls: (string | null | undefined)[]) {
    await Promise.all(
      urls
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
        .map((u) => this.s3Service.deleteFile(u).catch(() => {})),
    );
  }
}
