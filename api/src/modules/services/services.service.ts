// services.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { AddBookingServiceDto } from './dto/add-booking-service.dto';
import {
  PaginatedServiceResponseDto,
  ServiceResponseDto,
} from './dto/service-response.dto';
import { Prisma } from '@prisma/client';
import { BookingServiceResponseDto } from './dto/booking-service-response.dto';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ServicesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ==================== CREATE ====================
  async create(dto: CreateServiceDto): Promise<ServiceResponseDto> {
    // const { name, category, price } = dto;
    const { name, price } = dto;

    // Check tên trùng
    const existing = await this.prisma.service.findFirst({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(`Dịch vụ "${name}" đã tồn tại`);
    }

    const service = await this.prisma.service.create({
      // data: { name, category, price },
      data: { name, price },
      select: this.serviceSelect(),
    });

    await this.redis.delByPattern('services:');

    return this.transformService(service);
  }

  // ==================== FIND ALL ====================
  async findAll(query: QueryServiceDto): Promise<PaginatedServiceResponseDto> {
    const cacheKey = `services:${JSON.stringify(query)}`;

    return await this.redis.remember(cacheKey, 600, async () => {
      const { page = 1, limit = 10, search, is_active } = query;

      const skip = (page - 1) * limit;
      const where: Prisma.ServiceWhereInput = {};

      // Mặc định chỉ hiện active
      if (is_active !== undefined) {
        where.is_active = is_active;
      } else {
        where.is_active = true;
      }

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      // if (category) {
      //   where.category = { contains: category, mode: 'insensitive' };
      // }

      const [servicesRaw, total] = await Promise.all([
        this.prisma.service.findMany({
          where,
          skip,
          take: limit,
          select: this.serviceSelect(),
          orderBy: { name: 'asc' },
        }),
        this.prisma.service.count({ where }),
      ]);

      return {
        data: servicesRaw.map((s) => this.transformService(s)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  // ==================== FIND ONE ====================
  async findOne(id: string): Promise<ServiceResponseDto> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: this.serviceSelect(),
    });

    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }

    return this.transformService(service);
  }

  // ==================== UPDATE ====================
  async update(id: string, dto: UpdateServiceDto): Promise<ServiceResponseDto> {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }

    // Check tên trùng nếu update name
    if (dto.name && dto.name !== service.name) {
      const existing = await this.prisma.service.findFirst({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`Dịch vụ "${dto.name}" đã tồn tại`);
      }
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        // ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
      select: this.serviceSelect(),
    });

    await this.redis.delByPattern('services:');

    return this.transformService(updated);
  }

  // ==================== REMOVE ====================
  async remove(id: string): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }

    if (!service.is_active) {
      throw new BadRequestException('Dịch vụ đã bị vô hiệu hóa rồi');
    }

    await this.prisma.service.update({
      where: { id },
      data: { is_active: false },
    });

    await this.redis.delByPattern('services:');
  }

  // ==================== ADD TO BOOKING ====================
  async addToBooking(
    bookingId: string,
    dto: AddBookingServiceDto,
  ): Promise<BookingServiceResponseDto> {
    const { service_id, quantity, note } = dto;

    // Check booking tồn tại
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Chỉ thêm dịch vụ khi booking đang checked_in
    if (booking.status !== 'checked_in') {
      throw new BadRequestException(
        'Chỉ có thể thêm dịch vụ khi khách đang check-in',
      );
    }

    // Check service tồn tại và active
    const service = await this.prisma.service.findUnique({
      where: { id: service_id },
    });

    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }

    if (!service.is_active) {
      throw new BadRequestException('Dịch vụ đã bị vô hiệu hóa');
    }

    const unit_price = Number(service.price);
    const total_price = unit_price * quantity;

    // Tạo booking service
    const bookingService = await this.prisma.$transaction(async (tx) => {
      const bs = await tx.bookingService.create({
        data: {
          booking_id: bookingId,
          service_id,
          quantity,
          unit_price,
          total_price,
          note,
        },
        select: {
          id: true,
          quantity: true,
          unit_price: true,
          total_price: true,
          note: true,
          used_at: true,
          service: {
            select: {
              name: true,
              // category: true,
            },
          },
        },
      });

      // Cập nhật invoice nếu có
      const invoice = await tx.invoice.findUnique({
        where: { booking_id: bookingId },
      });

      if (invoice) {
        const newTotalAmount = Number(invoice.total_amount) + total_price;
        const newFinalAmount = newTotalAmount - Number(invoice.discount);

        await tx.invoice.update({
          where: { booking_id: bookingId },
          data: {
            total_amount: newTotalAmount,
            final_amount: newFinalAmount,
          },
        });
      }

      return bs;
    });

    return {
      id: bookingService.id,
      service_name: bookingService.service.name,
      // category: bookingService.service.category,
      quantity: bookingService.quantity,
      unit_price: Number(bookingService.unit_price),
      total_price: Number(bookingService.total_price),
      note: bookingService.note,
      used_at: bookingService.used_at,
    };
  }

  // ==================== REMOVE FROM BOOKING ====================
  async removeFromBooking(
    bookingId: string,
    bookingServiceId: string,
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    if (booking.status !== 'checked_in') {
      throw new BadRequestException(
        'Chỉ có thể xóa dịch vụ khi khách đang check-in',
      );
    }

    const bookingService = await this.prisma.bookingService.findFirst({
      where: {
        id: bookingServiceId,
        booking_id: bookingId,
      },
    });

    if (!bookingService) {
      throw new NotFoundException('Không tìm thấy dịch vụ trong booking');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bookingService.delete({
        where: { id: bookingServiceId },
      });

      // Cập nhật lại invoice
      const invoice = await tx.invoice.findUnique({
        where: { booking_id: bookingId },
      });

      if (invoice) {
        const newTotalAmount =
          Number(invoice.total_amount) - Number(bookingService.total_price);
        const newFinalAmount = newTotalAmount - Number(invoice.discount);

        await tx.invoice.update({
          where: { booking_id: bookingId },
          data: {
            total_amount: newTotalAmount,
            final_amount: newFinalAmount < 0 ? 0 : newFinalAmount,
          },
        });
      }
    });
  }

  // ==================== HELPERS ====================
  private serviceSelect() {
    return {
      id: true,
      name: true,
      // category: true,
      price: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    };
  }

  private transformService(service: any): ServiceResponseDto {
    return {
      ...service,
      price: Number(service.price),
    };
  }
}
