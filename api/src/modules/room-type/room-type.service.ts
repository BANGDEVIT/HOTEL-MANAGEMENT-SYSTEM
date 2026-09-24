import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Amenity, CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginationRoomTypeResponseDto,
  RoomTypeResponseDto,
} from './dto/response-room-type.dto';
import { QueryRoomTypeDto } from './dto/query-room-type.dto';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RoomTypeService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}
  async create(
    createRoomTypeDto: CreateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    const { name, base_price, capacity, amenities, bed_type } =
      createRoomTypeDto;

    const existingRoomType = await this.prisma.roomType.findFirst({
      where: { name },
    });

    if (existingRoomType) {
      throw new ConflictException('Room type has already existed');
    }

    const newRoomType = await this.prisma.roomType.create({
      data: {
        name,
        base_price,
        capacity,
        amenities: amenities ?? [],
        bed_type,
      },
      select: {
        id: true,
        name: true,
        base_price: true,
        capacity: true,
        amenities: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        bed_type: true,
      },
    });

    await this.redis.delByPattern('room-types:');

    return {
      ...newRoomType,
      base_price: Number(newRoomType.base_price),
      amenities: newRoomType.amenities as Amenity[],
    };
  }

  async findAll(
    query: QueryRoomTypeDto,
  ): Promise<PaginationRoomTypeResponseDto> {
    const cacheKey = `room-types:${JSON.stringify(query)}`;

    return this.redis.remember(cacheKey, 300, async () => {
      const { search, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const where: any = {
        is_active: true,
      };

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [roomTypesRaw, total] = await Promise.all([
        this.prisma.roomType.findMany({
          where,
          take: limit,
          skip,
          select: {
            id: true,
            name: true,
            base_price: true,
            capacity: true,
            amenities: true,
            is_active: true,
            updated_at: true,
            created_at: true,
            bed_type: true,
          },

          orderBy: { base_price: 'asc' },
        }),

        this.prisma.roomType.count({ where }),
      ]);

      const roomTypes = roomTypesRaw.map((r) => ({
        ...r,
        base_price: Number(r.base_price),
        amenities: r.amenities as Amenity[],
      }));

      return {
        data: roomTypes,
        total: total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      };
    });
  }

  async findOne(id: string): Promise<RoomTypeResponseDto> {
    const roomTypeRaw = await this.prisma.roomType.findUnique({
      where: { id, is_active: true },
      select: {
        id: true,
        name: true,
        base_price: true,
        capacity: true,
        amenities: true,
        created_at: true,
        is_active: true,
        updated_at: true,
        bed_type: true,
      },
    });

    if (!roomTypeRaw) {
      throw new NotFoundException('Room type not found');
    }

    return {
      ...roomTypeRaw,
      base_price: Number(roomTypeRaw.base_price),
      amenities: roomTypeRaw.amenities as Amenity[],
    };
  }

  async update(
    id: string,
    updateRoomTypeDto: UpdateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    const { base_price, name, amenities, capacity, bed_type } =
      updateRoomTypeDto;

    const roomType = await this.prisma.roomType.findUnique({
      where: { id },
    });

    if (!roomType) {
      throw new NotFoundException('RoomType not found');
    }

    if (name) {
      const existingName = await this.prisma.roomType.findFirst({
        where: {
          name,
          NOT: { id },
        },
      });

      if (existingName) {
        throw new ConflictException(`RoomType ${name} already exists`);
      }
    }

    const updatedRoomType = await this.prisma.roomType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(base_price !== undefined && { base_price }),
        ...(capacity !== undefined && { capacity }),
        ...(amenities && { amenities }),
        ...(bed_type && { bed_type }),
      },
      select: {
        id: true,
        name: true,
        base_price: true,
        capacity: true,
        amenities: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        bed_type: true,
      },
    });

    await this.redis.delByPattern('room-types:');

    return {
      ...updatedRoomType,
      base_price: Number(updatedRoomType.base_price),
      amenities: updatedRoomType.amenities as Amenity[],
    };
  }
  async remove(id: string): Promise<void> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id },
    });

    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    // Check đã xóa rồi chưa
    if (!roomType.is_active) {
      throw new BadRequestException('Room type đã bị xóa rồi');
    }

    // Check còn phòng active không
    const roomsCount = await this.prisma.room.count({
      where: { room_type_id: id },
    });

    if (roomsCount > 0) {
      throw new BadRequestException(
        `Không thể xóa — loại phòng này đang có ${roomsCount} phòng`,
      );
    }

    await this.prisma.roomType.update({
      where: { id },
      data: { is_active: false },
    });

    await this.redis.delByPattern('room-types:');
  }
}
