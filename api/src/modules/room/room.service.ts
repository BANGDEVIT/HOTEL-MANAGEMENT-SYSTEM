import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedRoomResponseDto,
  RoomResponseDto,
} from './dto/room-response.dto';
import { QueryRoomDto } from './dto/query-room.dto';
import { Prisma, RoomStatus } from '@prisma/client';
import { Amenity } from '../room-type/dto/create-room-type.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { S3Service } from '../../common/s3/s3.service';
import { QueryAvailableRoomDto } from './dto/query-available-room.dto';
import { RedisService } from '../../common/redis/redis.service';
import { UpdateRoomImagesDto } from './dto/update-room-images.dto';
import { RoomStatsDto } from './dto/room-stats.dto';

@Injectable()
export class RoomService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private redis: RedisService,
  ) {}

  private readonly MAX_IMAGES_PER_ROOM = 10;
  async create(createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    const { room_number, room_type_id, floor } = createRoomDto;

    // 1. Check room_type tồn tại và active
    const existingRoomType = await this.prisma.roomType.findUnique({
      where: { id: room_type_id },
    });

    if (!existingRoomType) {
      throw new NotFoundException('Room Type not found');
    }

    if (!existingRoomType.is_active) {
      throw new BadRequestException('Room type was deleted');
    }

    // 2. Check room_number trùng
    const existingRoom = await this.prisma.room.findUnique({
      where: { room_number },
    });

    if (existingRoom) {
      throw new ConflictException(`Number ${room_number} has already existed`);
    }

    // 3. Tạo phòng
    const newRoom = await this.prisma.room.create({
      data: {
        room_type_id,
        room_number,
        floor,
        images: [],
      },
      select: {
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
      },
    });

    return {
      ...newRoom,
      images: (newRoom.images as string[]) ?? [],
      room_type: {
        ...newRoom.room_type,
        base_price: Number(newRoom.room_type.base_price),
        amenities: newRoom.room_type.amenities as Amenity[],
      },
    };
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
    const skip = (page - 1) * limit;
    const where: Prisma.RoomWhereInput = {
      status: { not: 'inactive' },
    };

    if (status) {
      where.status = status;
    }

    if (floor) {
      where.floor = floor;
    }

    if (room_type_id) {
      const existingRoomType = await this.prisma.roomType.findUnique({
        where: { id: room_type_id },
      });

      if (!existingRoomType) {
        throw new NotFoundException('Room Type does not exist');
      }

      if (existingRoomType.is_active === false) {
        throw new BadRequestException('Room Type not active');
      }

      where.room_type_id = room_type_id;
    }

    // Search theo room_number hoặc tên room_type
    if (search) {
      where.OR = [{ room_number: { contains: search, mode: 'insensitive' } }];
    }

    const validSortFields = ['room_number', 'floor', 'status', 'created_at'];
    const orderBy: Prisma.RoomOrderByWithRelationInput =
      validSortFields.includes(sortBy)
        ? { [sortBy]: order }
        : { room_number: 'asc' };

    const [roomsRaw, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        take: limit,
        skip,
        select: this.roomSelect(),
        orderBy,
      }),

      this.prisma.room.count({ where }),
    ]);

    const rooms = roomsRaw.map((r) => ({
      ...r,
      images: (r.images as string[]) ?? [],
      room_type: {
        ...r.room_type,
        base_price: Number(r.room_type.base_price),
        amenities: r.room_type.amenities as Amenity[],
      },
    }));

    return {
      data: rooms,
      total: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<RoomResponseDto> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        room_number: true,
        floor: true,
        status: true,
        updated_at: true,
        created_at: true,
        images: true,
        room_type: {
          select: {
            id: true,
            name: true,
            base_price: true,
            capacity: true,
            bed_type: true,
            amenities: true,
            is_active: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room does not exist');
    }

    return this.transformRoom(room);
  }

  // ==================== FIND AVAILABLE ====================
  async findAvailable(query: QueryAvailableRoomDto) {
    const cacheKey = `rooms:available:${query.check_in_date}:${query.check_out_date}:${query.room_type_id ?? 'all'}:p${query.page ?? 1}`;

    return this.redis.remember(cacheKey, 60, async () => {
      const {
        check_in_date,
        check_out_date,
        room_type_id,
        capacity,
        page = 1,
        limit = 10,
      } = query;

      const checkIn = new Date(check_in_date);
      const checkOut = new Date(check_out_date);

      // 1. Validate ngày
      if (checkIn >= checkOut) {
        throw new BadRequestException('Ngày check-out phải sau ngày check-in');
      }

      if (checkIn < new Date(new Date().setHours(0, 0, 0, 0))) {
        throw new BadRequestException(
          'Ngày check-in không được là ngày trong quá khứ',
        );
      }

      // 2. Tìm phòng đã được đặt trong khoảng thời gian
      const bookedRoomIds = await this.prisma.bookingRoom.findMany({
        where: {
          booking: {
            status: { notIn: ['cancelled', 'checked_out'] },
            check_in_date: { lt: checkOut },
            check_out_date: { gt: checkIn },
          },
        },
        select: { room_id: true },
      });

      const bookedIds = bookedRoomIds.map((b) => b.room_id);

      // 3. Query phòng available (không nằm trong danh sách đã đặt)
      const skip = (page - 1) * limit;
      const where: Prisma.RoomWhereInput = {
        status: 'available',
        id: { notIn: bookedIds },
        ...(room_type_id && { room_type_id }),
        ...(capacity && {
          room_type: { capacity: { gte: capacity } },
        }),
      };

      const [roomsRaw, total] = await Promise.all([
        this.prisma.room.findMany({
          where,
          skip,
          take: limit,
          select: {
            ...this.roomSelect(),
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
          },
          orderBy: [{ room_type: { base_price: 'asc' } }, { floor: 'asc' }],
        }),
        this.prisma.room.count({ where }),
      ]);

      return {
        data: roomsRaw.map((r) => this.transformRoom(r)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        // ← Thêm thông tin tìm kiếm vào response
        search_info: {
          check_in_date,
          check_out_date,
          nights: Math.ceil(
            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
          ),
        },
      };
    });
  }
  async update(id: string, updateRoomDto: UpdateRoomDto) {
    const { room_type_id, floor } = updateRoomDto;
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room_type_id) {
      await this.validateRoomType(room_type_id);
    }

    const updateRoom = await this.prisma.room.update({
      where: { id },
      data: {
        ...(room_type_id && { room_type_id }),
        ...(floor != undefined && { floor }),
      },
      select: this.roomSelect(),
    });

    return this.transformRoom(updateRoom);
  }

  /**
   * Đếm phòng theo trạng thái trên TOÀN khách sạn.
   * Không nhận filter nào -> lọc danh sách thế nào con số cũng không đổi.
   */
  async getStats(): Promise<RoomStatsDto> {
    // SELECT status, COUNT(*) FROM "Room" GROUP BY status
    const grouped = await this.prisma.room.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    // Khởi tạo đủ 5 trạng thái = 0: trạng thái nào không có phòng
    // thì GROUP BY không trả về dòng đó, FE vẫn cần số 0
    const stats: Record<RoomStatus, number> = {
      available: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      inactive: 0,
    };

    for (const g of grouped) {
      stats[g.status] = g._count._all;
    }

    return {
      ...stats,
      // Phòng đã ẩn không tính vào tổng phòng đang kinh doanh
      total:
        stats.available + stats.occupied + stats.cleaning + stats.maintenance,
    };
  }
  async remove(id: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id },

      select: {
        id: true,
        status: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status === 'inactive') {
      throw new BadRequestException('Room already inactive');
    }

    if (room.status === 'occupied') {
      throw new BadRequestException('Không thể xóa phòng đang có khách');
    }

    await this.prisma.room.update({
      where: { id },

      data: {
        status: 'inactive',
      },
    });
  }

  async addImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<RoomResponseDto> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');

    // Upload từng file lên S3
    const uploadedUrls = await Promise.all(
      files.map((file) => this.s3Service.uploadFile(file, `rooms/${id}`)),
    );

    // Lấy danh sách ảnh cũ, ghép với ảnh mới
    const currentImages = (room.images as string[]) || [];
    const newImages = [...currentImages, ...uploadedUrls];

    // Cập nhật lại Room.images
    await this.prisma.room.update({
      where: { id },
      data: { images: newImages },
    });

    // Trả về phòng đã cập nhật
    return this.findOne(id);
  }

  async removeImages(
    id: string,
    imageUrls: string[],
  ): Promise<RoomResponseDto> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');

    const currentImages = (room.images as string[]) || [];

    // Lọc bỏ các ảnh cần xóa
    const remainingImages = currentImages.filter(
      (url) => !imageUrls.includes(url),
    );

    // Xóa ảnh trên S3 (không await để không làm chậm, nhưng vẫn log lỗi)
    Promise.all(
      imageUrls.map((url) =>
        this.s3Service.deleteFile(url).catch((e) => console.error(e)),
      ),
    );

    // Cập nhật DB
    await this.prisma.room.update({
      where: { id },
      data: { images: remainingImages },
    });

    return this.findOne(id);
  }

  /** Thêm ảnh mới vào cuối danh sách hiện có */
  async addImagesV2(
    id: string,
    files: Express.Multer.File[],
  ): Promise<RoomResponseDto> {
    if (!files?.length) {
      throw new BadRequestException('Chưa chọn ảnh nào');
    }

    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { id: true, images: true },
    });

    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    const current = (room.images as string[]) ?? [];
    if (current.length + files.length > this.MAX_IMAGES_PER_ROOM) {
      throw new BadRequestException(
        `Mỗi phòng tối đa ${this.MAX_IMAGES_PER_ROOM} ảnh. Hiện có ${current.length}.`,
      );
    }

    const newUrls = await this.s3Service.uploadMultiple(files, 'rooms');
    const updated = await this.prisma.room.update({
      where: { id },
      data: { images: { ...current, ...newUrls } },
      select: this.roomSelect(),
    });

    await this.redis.delByPattern('rooms:');
    return this.transformRoom(updated);
  }

  async updateImages(
    id: string,
    dto: UpdateRoomImagesDto,
  ): Promise<RoomResponseDto> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { id: true, images: true },
    });

    if (!room) throw new NotFoundException('Không tìm thấy phòng');

    const current = (room.images as string[]) ?? [];
    const next = dto.images;

    // Chặn URL lạ — chỉ cho phép sắp xếp hoặc bớt ảnh đã có,
    // không cho gán URL tuỳ ý từ bên ngoài
    const isValid = next.filter((i) => !current.includes(i));
    if (isValid.length > 0) {
      throw new BadRequestException(
        'Danh sách chứa ảnh không thuộc phòng này. Dùng endpoint thêm ảnh để tải ảnh mới.',
      );
    }

    const removed = current.filter((i) => !next.includes(i));

    const updated = await this.prisma.room.update({
      where: { id: room.id },
      data: { images: next },
      select: this.roomSelect(),
    });

    // Xoá file thừa sau khi DB đã cập nhật xong — nếu bước này lỗi
    // thì chỉ còn file mồ côi trên S3, dữ liệu vẫn đúng

    await this.s3Service.deleteMultiple(removed);
    await this.redis.delByPattern('rooms:');

    return this.transformRoom(updated);
  }

  // ============================HELPER======================================

  private roomSelect() {
    return {
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
    };
  }

  private transformRoom(room: any): RoomResponseDto {
    return {
      ...room,
      images: (room.images as string[]) ?? [],
      room_type: {
        ...room.room_type,
        base_price: Number(room.room_type.base_price),
        amenities: room.room_type.amenities as Amenity[],
      },
    };
  }

  private async validateRoomType(roomTypeId: string) {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      select: {
        id: true,
        is_active: true,
      },
    });

    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    if (!roomType.is_active) {
      throw new BadRequestException('Room type is not active');
    }

    return roomType;
  }

  // available   → cleaning ✅
  // available   → maintenance ✅
  // available   → occupied ❌ (hệ thống tự đổi khi check-in)npm
  // cleaning    → available ✅
  // maintenance → available ✅
  // occupied    → cleaning ✅ (sau check-out)
  // occupied    → available ❌ (phải qua cleaning trước)
  // inactive    → bất kỳ ❌ (đã xóa mềm)
  async updateStatus(id: string, dto: UpdateRoomStatusDto) {
    const { status: newStatus } = dto;
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const validTransitions: Record<string, string[]> = {
      available: ['cleaning', 'maintenance'],
      cleaning: ['available'],
      maintenance: ['available'],
      occupied: ['cleaning'],
      inactive: [],
    };

    const allowedStatus = validTransitions[room.status] ?? [];

    if (!allowedStatus.includes(newStatus)) {
      throw new BadRequestException(
        `Do not allow to transalte from ${room.status} to ${newStatus}`,
      );
    }

    const updateRoom = await this.prisma.room.update({
      where: { id },
      data: { status: newStatus },
      select: this.roomSelect(),
    });

    return this.transformRoom(updateRoom);
  }
}
