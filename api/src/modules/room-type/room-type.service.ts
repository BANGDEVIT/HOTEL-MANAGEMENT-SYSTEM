import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { addDays, todayYmd, toDate, toYmd } from '../booking/booking.rules';
import { Amenity, CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { QueryRoomTypeDto } from './dto/query-room-type.dto';
import {
  PaginationRoomTypeResponseDto,
  RoomTypeAdminItemDto,
  RoomTypeResponseDto,
} from './dto/response-room-type.dto';
import {
  capacityError,
  minCapacity,
  occupancyPct,
  overlapNights,
  type UpcomingBooking,
} from './room-type.rules';

const SELECT = {
  id: true,
  name: true,
  base_price: true,
  capacity: true,
  amenities: true,
  bed_type: true,
  area: true,
  description: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.RoomTypeSelect;

type Row = Prisma.RoomTypeGetPayload<{ select: typeof SELECT }>;

/** Booking còn giữ phòng (chưa kết thúc) */
const HOLDING = ['pending', 'confirmed', 'checked_in'] as const;
/** Booking đã thật sự ở -> tính công suất, doanh thu */
const STAYED = ['checked_in', 'checked_out'] as const;
const WINDOW_DAYS = 30;

const CACHE_PREFIX = 'room-types:';

@Injectable()
export class RoomTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ============================================================
   *  CÔNG KHAI (trang Phòng, trang khách đặt phòng): chỉ loại đang kinh doanh
   * ============================================================ */

  async findAll(
    query: QueryRoomTypeDto,
  ): Promise<PaginationRoomTypeResponseDto> {
    const cacheKey = `${CACHE_PREFIX}${JSON.stringify(query)}`;

    return this.redis.remember(cacheKey, 300, async () => {
      const { search, page = 1, limit = 10 } = query;
      const where: Prisma.RoomTypeWhereInput = {
        is_active: true,
        ...(search?.trim() && {
          name: { contains: search.trim(), mode: 'insensitive' },
        }),
      };

      const [rows, total] = await Promise.all([
        this.prisma.roomType.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          select: SELECT,
          orderBy: [{ base_price: 'asc' }, { name: 'asc' }],
        }),
        this.prisma.roomType.count({ where }),
      ]);

      return {
        data: rows.map(toDto),
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      };
    });
  }

  async findOne(id: string): Promise<RoomTypeResponseDto> {
    const row = await this.prisma.roomType.findFirst({
      where: { id, is_active: true },
      select: SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy loại phòng');
    return toDto(row);
  }

  /* ============================================================
   *  MÀN QUẢN LÝ: mọi loại (kể cả ngừng kinh doanh) + số liệu vận hành
   *  Khách sạn chỉ vài loại phòng -> trả hết, không phân trang, FE tự lọc / tìm
   * ============================================================ */

  async findAllForManage(): Promise<RoomTypeAdminItemDto[]> {
    return this.adminItems();
  }

  /* ============================================================
   *  THÊM / SỬA / BẬT TẮT / XOÁ
   * ============================================================ */

  async create(dto: CreateRoomTypeDto): Promise<RoomTypeAdminItemDto> {
    const name = cleanName(dto.name);
    await this.assertNameFree(name);

    const created = await this.prisma.roomType.create({
      data: {
        name,
        base_price: dto.base_price,
        capacity: dto.capacity,
        bed_type: dto.bed_type,
        amenities: dto.amenities ?? [],
        area: dto.area ?? null,
        description: dto.description ?? null,
      },
      select: { id: true },
    });

    await this.clearCache();
    return this.adminItem(created.id);
  }

  /**
   * Đổi giá: CHỈ áp dụng cho booking tạo sau đó (giá đã chốt ở booking_rooms.price_per_night).
   * Giảm sức chứa: không được thấp hơn mức các booking sắp tới đang cần.
   */
  async update(
    id: string,
    dto: UpdateRoomTypeDto,
  ): Promise<RoomTypeAdminItemDto> {
    await this.mustExist(id);

    const name = dto.name !== undefined ? cleanName(dto.name) : undefined;
    if (name) await this.assertNameFree(name, id);

    if (dto.capacity !== undefined) {
      const err = capacityError(dto.capacity, await this.requiredCapacity(id));
      if (err) throw new BadRequestException(err);
    }

    await this.prisma.roomType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(dto.base_price !== undefined && { base_price: dto.base_price }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.bed_type && { bed_type: dto.bed_type }),
        ...(dto.amenities && { amenities: dto.amenities }),
        ...(dto.area !== undefined && { area: dto.area }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    await this.clearCache();
    return this.adminItem(id);
  }

  /**
   * Ngừng kinh doanh: không nhận booking MỚI cho loại này.
   * Booking đã có vẫn giữ nguyên (FE hiện số booking sắp tới để quản lý cân nhắc).
   */
  async setActive(
    id: string,
    isActive: boolean,
  ): Promise<RoomTypeAdminItemDto> {
    await this.mustExist(id);
    await this.prisma.roomType.update({
      where: { id },
      data: { is_active: isActive },
    });
    await this.clearCache();
    return this.adminItem(id);
  }

  /**
   * Xoá HẲN chỉ khi chưa có phòng nào thuộc loại này (tạo nhầm).
   * Đã có phòng -> 409, dùng "Ngừng kinh doanh" để giữ lịch sử booking / hoá đơn.
   */
  async remove(id: string): Promise<void> {
    await this.mustExist(id);
    const rooms = await this.prisma.room.count({ where: { room_type_id: id } });
    if (rooms > 0) {
      throw new ConflictException(
        `Loại phòng đang có ${rooms} phòng nên không xoá được. Hãy chuyển phòng sang loại khác hoặc ngừng kinh doanh`,
      );
    }
    await this.prisma.roomType.delete({ where: { id } });
    await this.clearCache();
  }

  /* ============================================================
   *  HELPER
   * ============================================================ */

  private async adminItem(id: string): Promise<RoomTypeAdminItemDto> {
    const [item] = await this.adminItems(id);
    if (!item) throw new NotFoundException('Không tìm thấy loại phòng');
    return item;
  }

  /**
   * Gom số liệu cho 1 hoặc mọi loại phòng bằng 3 truy vấn (không N+1):
   *   1. Loại phòng + trạng thái các phòng
   *   2. Các đêm đã bán trong 30 ngày qua (công suất, doanh thu tiền phòng)
   *   3. Booking chưa kết thúc (số booking sắp tới, sức chứa tối thiểu)
   */
  private async adminItems(onlyId?: string): Promise<RoomTypeAdminItemDto[]> {
    const today = todayYmd();
    const winFrom = addDays(today, -WINDOW_DAYS);
    const typeFilter = onlyId ? { room: { room_type_id: onlyId } } : {};

    const [types, sold, upcoming] = await Promise.all([
      this.prisma.roomType.findMany({
        where: onlyId ? { id: onlyId } : {},
        orderBy: [
          { is_active: 'desc' },
          { base_price: 'asc' },
          { name: 'asc' },
        ],
        select: { ...SELECT, rooms: { select: { status: true } } },
      }),
      this.prisma.bookingRoom.findMany({
        where: {
          ...typeFilter,
          booking: {
            status: { in: [...STAYED] },
            check_in_date: { lt: toDate(today) },
            check_out_date: { gt: toDate(winFrom) },
          },
        },
        select: {
          price_per_night: true,
          room: { select: { room_type_id: true } },
          booking: { select: { check_in_date: true, check_out_date: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          status: { in: [...HOLDING] },
          check_out_date: { gte: toDate(today) },
          ...(onlyId && {
            booking_rooms: { some: { room: { room_type_id: onlyId } } },
          }),
        },
        select: {
          id: true,
          adults: true,
          children: true,
          booking_rooms: {
            select: {
              room: {
                select: {
                  room_type_id: true,
                  room_type: { select: { capacity: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Đêm đã bán + doanh thu theo loại
    const soldBy = new Map<string, { nights: number; revenue: number }>();
    for (const br of sold) {
      const n = overlapNights(
        toYmd(br.booking.check_in_date),
        toYmd(br.booking.check_out_date),
        winFrom,
        today,
      );
      if (!n) continue;
      const acc = soldBy.get(br.room.room_type_id) ?? { nights: 0, revenue: 0 };
      acc.nights += n;
      acc.revenue += n * Number(br.price_per_night);
      soldBy.set(br.room.room_type_id, acc);
    }

    // Booking sắp tới theo loại
    const upcomingBy = new Map<string, UpcomingBooking[]>();
    for (const b of upcoming) {
      const typeIds = new Set(
        b.booking_rooms.map((br) => br.room.room_type_id),
      );
      for (const typeId of typeIds) {
        const ofType = b.booking_rooms.filter(
          (br) => br.room.room_type_id === typeId,
        ).length;
        const other = b.booking_rooms
          .filter((br) => br.room.room_type_id !== typeId)
          .reduce((sum, br) => sum + br.room.room_type.capacity, 0);
        const list = upcomingBy.get(typeId) ?? [];
        list.push({
          guests: b.adults + b.children,
          roomsOfType: ofType,
          otherCapacity: other,
        });
        upcomingBy.set(typeId, list);
      }
    }

    return types.map(({ rooms, ...t }) => {
      const count = countRooms(rooms.map((r) => r.status));
      const s = soldBy.get(t.id) ?? { nights: 0, revenue: 0 };
      const up = upcomingBy.get(t.id) ?? [];
      return {
        ...toDto(t),
        rooms: count,
        occupancy_30d: occupancyPct(
          s.nights,
          count.total - count.inactive,
          WINDOW_DAYS,
        ),
        revenue_30d: s.revenue,
        upcoming_bookings: up.length,
        max_upcoming_guests: minCapacity(up),
        can_delete: count.total === 0,
      };
    });
  }

  private async requiredCapacity(id: string): Promise<number> {
    const [item] = await this.adminItems(id);
    return item?.max_upcoming_guests ?? 1;
  }

  private async mustExist(id: string) {
    const found = await this.prisma.roomType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy loại phòng');
  }

  /** Cột name @unique phân biệt hoa thường -> tự kiểm tra thêm "deluxe" trùng "Deluxe" */
  private async assertNameFree(name: string, exceptId?: string) {
    const dup = await this.prisma.roomType.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { name: true },
    });
    if (dup) throw new ConflictException(`Đã có loại phòng "${dup.name}"`);
  }

  /** Đổi loại phòng làm đổi giá / sức chứa hiện ở trang Phòng -> xoá cache cả 2 */
  private async clearCache() {
    await Promise.all([
      this.redis.delByPattern(CACHE_PREFIX),
      this.redis.delByPattern('rooms:'),
    ]);
  }
}

/* ============================================================ */

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

function toDto(r: Row): RoomTypeResponseDto {
  return {
    ...r,
    base_price: Number(r.base_price),
    amenities: (Array.isArray(r.amenities) ? r.amenities : []) as Amenity[],
  };
}

function countRooms(statuses: RoomStatus[]) {
  const c = {
    total: statuses.length,
    available: 0,
    occupied: 0,
    cleaning: 0,
    maintenance: 0,
    inactive: 0,
  };
  for (const s of statuses) c[s]++;
  return c;
}
