import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedRoomResponseDto,
  RoomResponseDto,
} from './dto/room-response.dto';
import { QueryRoomDto } from './dto/query-room.dto';
import { Amenity } from '../room-type/dto/create-room-type.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { S3Service } from '../../common/s3/s3.service';
import { QueryAvailableRoomDto } from './dto/query-available-room.dto';
import { RedisService } from '../../common/redis/redis.service';
import { UpdateRoomImagesDto } from './dto/update-room-images.dto';
import { FloorStatsDto, RoomStatsDto } from './dto/room-stats.dto';

/**
 * Các field trả về cho FE. Khai báo 1 lần, dùng chung cho mọi query.
 * `satisfies` giữ nguyên kiểu literal (true) -> Prisma suy ra đúng kiểu kết quả.
 */
const ROOM_SELECT = {
  id: true,
  room_number: true,
  floor: true,
  status: true,
  created_at: true,
  updated_at: true,
  images: true,
  room_type: {
    select: {
      id: true,
      name: true,
      base_price: true,
      capacity: true,
      bed_type: true,
      amenities: true,
    },
  },
} satisfies Prisma.RoomSelect;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof ROOM_SELECT }>;

/**
 * Chuyển trạng thái hợp lệ:
 *   available   → cleaning, maintenance
 *   cleaning    → available
 *   maintenance → available
 *   occupied    → cleaning      (sau check-out)
 *   available   → occupied  ❌  (hệ thống tự đổi khi check-in)
 *   occupied    → available ❌  (phải qua dọn phòng trước)
 *   inactive    → bất kỳ    ❌  (đã ẩn)
 */
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available'],
  maintenance: ['available'],
  occupied: ['cleaning'],
  inactive: [],
};

const STATUS_LABEL: Record<RoomStatus, string> = {
  available: 'Trống',
  occupied: 'Có khách',
  cleaning: 'Đang dọn',
  maintenance: 'Bảo trì',
  inactive: 'Đã ẩn',
};

const HOTEL_TZ = 'Asia/Ho_Chi_Minh';
/** "2026-09-27" theo giờ khách sạn, không theo giờ server */
const todayYmd = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: HOTEL_TZ });

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private readonly MAX_IMAGES_PER_ROOM = 10;

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private redis: RedisService,
  ) {}

  /* ============================ TẠO / ĐỌC ============================ */

  async create(createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    const { room_number, room_type_id, floor } = createRoomDto;

    await this.validateRoomType(room_type_id);

    const existingRoom = await this.prisma.room.findUnique({
      where: { room_number },
      select: { id: true },
    });
    if (existingRoom) {
      throw new ConflictException(`Số phòng ${room_number} đã tồn tại`);
    }

    const newRoom = await this.prisma.room.create({
      data: { room_type_id, room_number, floor, images: [] },
      select: ROOM_SELECT,
    });

    await this.clearRoomCache();
    return this.transformRoom(newRoom);
  }

  async findAll(query: QueryRoomDto): Promise<PaginatedRoomResponseDto> {
    const {
      page = 1,
      limit = 10,
      status,
      room_type_id,
      floor,
      sortBy = 'room_number',
      order = 'asc',
      search,
    } = query;

    const where: Prisma.RoomWhereInput = { status: { not: 'inactive' } };

    if (status) where.status = status;
    if (floor !== undefined) where.floor = floor; // floor = 0 (tầng trệt) vẫn lọc được

    if (room_type_id) {
      await this.validateRoomType(room_type_id);
      where.room_type_id = room_type_id;
    }

    if (search) {
      where.room_number = { contains: search, mode: 'insensitive' };
    }

    const validSortFields = ['room_number', 'floor', 'status', 'created_at'];
    const orderBy: Prisma.RoomOrderByWithRelationInput =
      validSortFields.includes(sortBy)
        ? { [sortBy]: order }
        : { room_number: 'asc' };

    const [rows, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        select: ROOM_SELECT,
        orderBy,
      }),
      this.prisma.room.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.transformRoom(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<RoomResponseDto> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: ROOM_SELECT,
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    return this.transformRoom(room);
  }

  /* ============================ PHÒNG TRỐNG THEO NGÀY ============================ */

  async findAvailable(query: QueryAvailableRoomDto) {
    const {
      check_in_date,
      check_out_date,
      room_type_id,
      capacity,
      page = 1,
      limit = 10,
    } = query;

    // "YYYY-MM-DD" -> Date 00:00 UTC, khớp cách lưu cột @db.Date
    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);
    const checkInYmd = checkIn.toISOString().slice(0, 10);

    // Kiểm tra TRƯỚC khi vào cache: request sai thì báo lỗi luôn, không đụng Redis
    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng');
    }
    if (checkInYmd < todayYmd()) {
      throw new BadRequestException('Ngày nhận phòng không được ở quá khứ');
    }

    // Key phải chứa MỌI tham số ảnh hưởng tới kết quả, thiếu 1 cái là trả nhầm kết quả của lượt tìm khác
    const cacheKey = [
      'rooms:available',
      checkInYmd,
      checkOut.toISOString().slice(0, 10),
      room_type_id ?? 'all',
      `c${capacity ?? 0}`,
      `p${page}`,
      `l${limit}`,
    ].join(':');

    return this.redis.remember(cacheKey, 60, async () => {
      // 1. Phòng đã có booking giao với khoảng ngày cần tìm
      //    Giao nhau khi: booking.in < checkOut VÀ booking.out > checkIn
      const booked = await this.prisma.bookingRoom.findMany({
        where: {
          booking: {
            status: { notIn: ['cancelled', 'checked_out'] },
            check_in_date: { lt: checkOut },
            check_out_date: { gt: checkIn },
          },
        },
        select: { room_id: true },
      });

      // 2. KHÔNG lọc status = 'available': phòng đang có khách hôm nay
      //    vẫn có thể trống vào tuần sau. Việc trùng lịch đã được bước 1 lo.
      //    Chỉ loại phòng đã ẩn và phòng đang bảo trì.
      const where: Prisma.RoomWhereInput = {
        status: { notIn: ['inactive', 'maintenance'] },
        id: { notIn: booked.map((b) => b.room_id) },
        ...(room_type_id && { room_type_id }),
        ...(capacity && { room_type: { capacity: { gte: capacity } } }),
      };

      const [rows, total] = await Promise.all([
        this.prisma.room.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          select: ROOM_SELECT,
          orderBy: [{ room_type: { base_price: 'asc' } }, { floor: 'asc' }],
        }),
        this.prisma.room.count({ where }),
      ]);

      return {
        data: rows.map((r) => this.transformRoom(r)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        search_info: {
          check_in_date,
          check_out_date,
          nights: Math.round(
            (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
          ),
        },
      };
    });
  }

  /* ============================ CẬP NHẬT ============================ */

  async update(
    id: string,
    updateRoomDto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    const { room_type_id, floor } = updateRoomDto;

    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if (room.status === 'inactive') {
      throw new BadRequestException('Phòng đã ẩn, không sửa được');
    }

    if (room_type_id) await this.validateRoomType(room_type_id);

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        ...(room_type_id && { room_type_id }),
        ...(floor !== undefined && { floor }),
      },
      select: ROOM_SELECT,
    });

    await this.clearRoomCache();
    return this.transformRoom(updated);
  }

  async updateStatus(
    id: string,
    dto: UpdateRoomStatusDto,
  ): Promise<RoomResponseDto> {
    const { status: newStatus } = dto;

    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    if (!VALID_TRANSITIONS[room.status].includes(newStatus)) {
      throw new BadRequestException(
        `Không thể chuyển phòng từ "${STATUS_LABEL[room.status]}" sang "${STATUS_LABEL[newStatus]}"`,
      );
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: { status: newStatus },
      select: ROOM_SELECT,
    });

    await this.clearRoomCache();
    return this.transformRoom(updated);
  }

  /** Ẩn phòng (xoá mềm) */
  async remove(id: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if (room.status === 'inactive')
      throw new BadRequestException('Phòng đã ẩn trước đó');
    if (room.status === 'occupied') {
      throw new BadRequestException('Không thể ẩn phòng đang có khách');
    }

    // Còn booking chưa kết thúc -> ẩn phòng thì khách đến nơi không có phòng
    const upcoming = await this.prisma.bookingRoom.count({
      where: {
        room_id: id,
        booking: {
          status: { in: ['pending', 'confirmed', 'checked_in'] },
          check_out_date: { gt: new Date(`${todayYmd()}T00:00:00Z`) },
        },
      },
    });
    if (upcoming > 0) {
      throw new BadRequestException(
        `Phòng còn ${upcoming} booking sắp tới. Chuyển khách sang phòng khác trước khi ẩn.`,
      );
    }

    await this.prisma.room.update({
      where: { id },
      data: { status: 'inactive' },
    });
    await this.clearRoomCache();
  }

  /* ============================ ẢNH ============================ */

  /** Thêm ảnh mới vào cuối danh sách hiện có */
  async addImagesV2(
    id: string,
    files: Express.Multer.File[],
  ): Promise<RoomResponseDto> {
    if (!files?.length) throw new BadRequestException('Chưa chọn ảnh nào');

    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { images: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    const current = this.toImageList(room.images);
    if (current.length + files.length > this.MAX_IMAGES_PER_ROOM) {
      throw new BadRequestException(
        `Mỗi phòng tối đa ${this.MAX_IMAGES_PER_ROOM} ảnh. Hiện có ${current.length}.`,
      );
    }

    // Thứ tự: kiểm tra -> upload -> ghi DB (lỗi thì xoá ảnh vừa upload)
    const newUrls = await this.s3Service.uploadMultiple(files, `rooms/${id}`);

    try {
      const updated = await this.prisma.room.update({
        where: { id },
        data: { images: [...current, ...newUrls] }, // ngoặc VUÔNG = mảng
        select: ROOM_SELECT,
      });
      await this.clearRoomCache();
      return this.transformRoom(updated);
    } catch (e) {
      await this.s3Service
        .deleteMultiple(newUrls)
        .catch((err) =>
          this.logger.error('Không dọn được ảnh vừa upload', err),
        );
      throw e;
    }
  }

  /**
   * Sắp xếp lại hoặc bớt ảnh: FE gửi danh sách CUỐI CÙNG.
   * Ảnh không còn trong danh sách sẽ bị xoá khỏi S3.
   */
  async updateImages(
    id: string,
    dto: UpdateRoomImagesDto,
  ): Promise<RoomResponseDto> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { images: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    const current = this.toImageList(room.images);
    const next = dto.images;

    // Chỉ cho sắp xếp hoặc bớt ảnh đã có, không cho gán URL lạ từ bên ngoài
    if (next.some((url) => !current.includes(url))) {
      throw new BadRequestException(
        'Danh sách chứa ảnh không thuộc phòng này. Dùng chức năng thêm ảnh để tải ảnh mới.',
      );
    }
    if (new Set(next).size !== next.length) {
      throw new BadRequestException('Danh sách ảnh bị trùng');
    }

    const removed = current.filter((url) => !next.includes(url));

    const updated = await this.prisma.room.update({
      where: { id },
      data: { images: next },
      select: ROOM_SELECT,
    });
    await this.clearRoomCache();

    // Xoá file SAU khi DB đã đúng. Lỗi ở bước này chỉ để lại file thừa trên S3,
    // không làm hỏng dữ liệu -> ghi log thay vì báo lỗi cho người dùng
    if (removed.length) {
      await this.s3Service
        .deleteMultiple(removed)
        .catch((err) =>
          this.logger.error(
            `Không xoá được ${removed.length} ảnh trên S3`,
            err,
          ),
        );
    }

    return this.transformRoom(updated);
  }

  /* ============================ THỐNG KÊ ============================ */

  /**
   * Đếm phòng theo trạng thái trên TOÀN khách sạn.
   * Không nhận filter nào -> lọc danh sách thế nào con số cũng không đổi.
   */
  async getStats(): Promise<RoomStatsDto> {
    const grouped = await this.prisma.room.groupBy({
      by: ['floor', 'status'],
      _count: { _all: true },
    });

    // Khởi tạo đủ trạng thái = 0: GROUP BY không trả về dòng cho trạng thái không có phòng
    const stats: Record<RoomStatus, number> = {
      available: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      inactive: 0,
    };
    const floors = new Map<number, FloorStatsDto>();

    for (const g of grouped) {
      const n = g._count._all;
      stats[g.status] += n;

      // Phòng đã ẩn không hiện trên thanh tầng
      if (g.status === 'inactive') continue;

      let f = floors.get(g.floor);
      if (!f) {
        f = {
          floor: g.floor,
          total: 0,
          available: 0,
          occupied: 0,
          cleaning: 0,
          maintenance: 0,
        };
        floors.set(g.floor, f);
      }
      f[g.status] += n;
      f.total += n;
    }

    return {
      ...stats,
      total:
        stats.available + stats.occupied + stats.cleaning + stats.maintenance,
      floors: [...floors.values()].sort((a, b) => a.floor - b.floor),
    };
  }

  /* ============================ HELPER ============================ */

  private transformRoom(room: RoomRow): RoomResponseDto {
    return {
      ...room,
      images: this.toImageList(room.images),
      room_type: {
        ...room.room_type,
        base_price: Number(room.room_type.base_price), // Decimal -> number
        amenities: room.room_type.amenities as Amenity[],
      },
    };
  }

  /** Cột Json có thể chứa bất cứ thứ gì -> chỉ nhận mảng chuỗi, còn lại coi như rỗng */
  private toImageList(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string')
      : [];
  }

  private async validateRoomType(roomTypeId: string) {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      select: { id: true, is_active: true },
    });
    if (!roomType) throw new NotFoundException('Không tìm thấy loại phòng');
    if (!roomType.is_active)
      throw new BadRequestException('Loại phòng đã ngừng sử dụng');
    return roomType;
  }

  /** Mọi thay đổi về phòng đều phải xoá cache tìm phòng trống */
  private clearRoomCache() {
    return this.redis.delByPattern('rooms:');
  }
}
