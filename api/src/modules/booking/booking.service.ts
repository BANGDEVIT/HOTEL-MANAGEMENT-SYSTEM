import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

import {
  BookingResponseDto,
  PaginatedBookingResponseDto,
} from './dto/booking-response.dto';
import { Prisma } from '@prisma/client';
import { QueryBookingDto } from './dto/quey-booking.dto';
import { S3Service } from '../../common/s3/s3.service';
import { MailService } from '../../common/mail/mail.service';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private mailService: MailService,
  ) {}

  // ==================== CREATE ====================
  async create(
    dto: CreateBookingDto,
    accountId: string,
    roles: string[],
  ): Promise<BookingResponseDto> {
    const {
      customer_id,
      room_ids,
      check_in_date,
      check_out_date,
      booking_type,
      // special_requests,
      override_prices,
    } = dto;

    let finalCustomerId: string;
    if (roles.includes('customer')) {
      const customer = await this.prisma.customer.findUnique({
        where: { account_id: accountId },
        select: { id: true },
      });
      if (!customer) {
        throw new ForbiddenException('Không tìm thấy thông tin khách hàng');
      }
      finalCustomerId = customer.id;
    } else {
      // Staff/manager/admin: dùng customer_id từ DTO, phải tồn tại
      const customerExists = await this.prisma.customer.findUnique({
        where: { id: customer_id },
      });
      if (!customerExists) {
        throw new NotFoundException('Không tìm thấy khách hàng');
      }
      finalCustomerId = customer_id;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: finalCustomerId },
    });

    if (!customer?.phone) {
      throw new BadRequestException(
        'Khách hàng chưa có số điện thoại. Vui lòng cập nhật trước khi đặt phòng.',
      );
    }

    // Tìm employee từ accountId
    let employeeId: string | undefined = undefined;

    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
    });

    if (employee) {
      employeeId = employee.id;
    }

    // 1. Check ngày hợp lệ
    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày check-out phải sau ngày check-in');
    }

    if (checkIn < today) {
      throw new BadRequestException(
        'Ngày check-in không được là ngày trong quá khứ',
      );
    }

    // 2. Check customer tồn tại
    // const customer = await this.prisma.customer.findUnique({
    //   where: { id: customer_id },
    // });

    // if (!customer) {
    //   throw new NotFoundException('Không tìm thấy khách hàng');
    // }

    // 3. Check phòng tồn tại
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: room_ids } },
      include: {
        room_type: {
          select: {
            id: true,
            name: true,
            base_price: true,
          },
        },
      },
    });

    if (rooms.length !== room_ids.length) {
      const foundIds = rooms.map((r) => r.id);
      const notFoundIds = room_ids.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Không tìm thấy phòng với id: ${notFoundIds.join(', ')}`,
      );
    }

    // Check phòng inactive
    const inactiveRooms = rooms.filter((r) => r.status === 'inactive');
    if (inactiveRooms.length > 0) {
      throw new BadRequestException(
        `Phòng ${inactiveRooms.map((r) => r.room_number).join(', ')} đã bị vô hiệu hóa`,
      );
    }

    // 4. Check phòng trống trong khoảng thời gian
    const overlappingBookings = await this.prisma.bookingRoom.findMany({
      where: {
        room_id: { in: room_ids },
        booking: {
          status: { notIn: ['cancelled', 'checked_out'] },
          check_in_date: { lt: checkOut },
          check_out_date: { gt: checkIn },
        },
      },
      include: {
        room: { select: { room_number: true } },
      },
    });

    if (overlappingBookings.length > 0) {
      const occupiedRooms = [
        ...new Set(overlappingBookings.map((b) => b.room.room_number)),
      ].join(', ');
      throw new ConflictException(
        `Phòng ${occupiedRooms} đã được đặt trong khoảng thời gian này`,
      );
    }

    // 5. Validate override_prices
    if (override_prices) {
      for (const [roomId, price] of Object.entries(override_prices)) {
        if (!room_ids.includes(roomId)) {
          throw new BadRequestException(
            `room_id ${roomId} trong override_prices không có trong danh sách phòng`,
          );
        }
        if (price <= 0) {
          throw new BadRequestException('Giá phòng phải lớn hơn 0');
        }
      }
    }

    // 6. Tạo booking trong transaction
    const booking = await this.prisma.$transaction(async (tx) => {
      const isWalkIn = booking_type === 'walk_in';
      const newBooking = await tx.booking.create({
        data: {
          customer_id: finalCustomerId,
          created_by: employeeId,
          booking_type,
          check_in_date: checkIn,
          check_out_date: checkOut,
          status: isWalkIn ? 'confirmed' : 'pending',
          // special_requests,
        },
      });

      // Tạo booking room

      await tx.bookingRoom.createMany({
        data: rooms.map((room) => ({
          booking_id: newBooking.id,
          room_id: room.id,
          price_per_night:
            override_prices?.[room.id] ?? Number(room.room_type.base_price),
        })),
      });

      // Sau khi tạo booking và booking_rooms, nếu là walk-in thì tạo invoice luôn
      if (isWalkIn) {
        const nights = Math.ceil(
          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
        );
        const totalRoomPrice = rooms.reduce((sum, room) => {
          const pricePerNight =
            override_prices?.[room.id] ?? Number(room.room_type.base_price);
          return sum + pricePerNight * nights;
        }, 0);
        // (Có thể tính cả dịch vụ nếu có, nhưng booking mới thì chưa có)
        await tx.invoice.create({
          data: {
            booking_id: newBooking.id,
            total_amount: totalRoomPrice,
            discount: 0,
            final_amount: totalRoomPrice,
            status: 'unpaid',
          },
        });
      }

      return newBooking;
    });

    // Online → confirm() gọi ngoài transaction (booking đã tồn tại trong DB)
    // if (booking_type === 'online') {
    //   // → Invoice được tạo ngay
    //   await this.confirm(booking.id); // ← an toàn vì booking đã được commit
    // }

    return this.findOne(booking.id);
  }

  // ==================== FIND ALL ====================
  async findAll(query: QueryBookingDto): Promise<PaginatedBookingResponseDto> {
    const {
      page = 1,
      limit = 10,
      status,
      booking_type,
      customer_id,
      from_date,
      to_date,
      search,
      sortBy = 'created_at',
      order = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {};

    if (status) where.status = status;
    if (booking_type) where.booking_type = booking_type;
    if (customer_id) where.customer_id = customer_id;

    if (from_date && to_date) {
      where.AND = [
        { check_in_date: { lt: new Date(to_date) } },
        { check_out_date: { gt: new Date(from_date) } },
      ];
    } else if (from_date) {
      where.check_out_date = { gt: new Date(from_date) };
    } else if (to_date) {
      where.check_in_date = { lt: new Date(to_date) };
    }

    // Search theo tên khách hàng
    if (search) {
      where.customer = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const validSortFields = [
      'created_at',
      'check_in_date',
      'check_out_date',
      'status',
    ];
    const orderBy: Prisma.BookingOrderByWithRelationInput =
      validSortFields.includes(sortBy)
        ? { [sortBy]: order }
        : { created_at: 'desc' };

    const [bookingsRaw, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: this.bookingSelect(),
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookingsRaw.map((b) => this.transformBooking(b)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== FIND ONE ====================
  async findOne(id: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: this.bookingSelect(),
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    return this.transformBooking(booking);
  }

  // ==================== MY BOOKINGS ====================
  async getMyBookings(
    accountId: string,
    query: QueryBookingDto,
  ): Promise<PaginatedBookingResponseDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
    });

    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    return this.findAll({ ...query, customer_id: customer.id });
  }

  // ==================== UPDATE ====================
  async update(id: string, dto: UpdateBookingDto): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    if (booking.status !== 'pending') {
      throw new BadRequestException(
        'Chỉ có thể cập nhật booking ở trạng thái pending',
      );
    }

    const { check_in_date, check_out_date } = dto;

    if (check_in_date || check_out_date) {
      const checkIn = new Date(check_in_date ?? booking.check_in_date);
      const checkOut = new Date(check_out_date ?? booking.check_out_date);

      if (checkIn >= checkOut) {
        throw new BadRequestException('Ngày check-out phải sau ngày check-in');
      }

      // Lấy danh sách room_id của booking hiện tại
      const bookingRooms = await this.prisma.bookingRoom.findMany({
        where: { booking_id: id },
        select: { room_id: true },
      });
      const roomIds = bookingRooms.map((br) => br.room_id);

      // Kiểm tra xem với ngày mới có bị trùng với booking nào khác không
      const overlapping = await this.prisma.bookingRoom.findFirst({
        where: {
          room_id: { in: roomIds },
          booking_id: { not: id },
          booking: {
            status: { notIn: ['cancelled', 'checked_out'] },
            check_in_date: { lt: checkOut },
            check_out_date: { gt: checkIn },
          },
        },
      });

      if (overlapping) {
        throw new ConflictException(
          'Phòng đã được đặt trong khoảng thời gian mới, không thể cập nhật ngày',
        );
      }
    }

    await this.prisma.booking.update({
      where: { id },
      data: {
        ...(check_in_date && { check_in_date: new Date(check_in_date) }), // ...undefine se ko hien
        ...(check_out_date && { check_out_date: new Date(check_out_date) }),
        // ...(special_requests !== undefined && { special_requests }),
      },
    });

    return this.findOne(id);
  }

  // ==================== CONFIRM ====================
  async confirm(id: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        booking_rooms: true,
        booking_services: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    if (booking.status !== 'pending') {
      throw new BadRequestException(
        'Chỉ có thể confirm booking ở trạng thái pending',
      );
    }

    // Re-check phòng trống
    const overlapping = await this.prisma.bookingRoom.findFirst({
      where: {
        room_id: { in: booking.booking_rooms.map((br) => br.room_id) },
        booking_id: { not: id },
        booking: {
          status: { notIn: ['cancelled', 'checked_out'] }, // ← fix
          check_in_date: { lt: booking.check_out_date },
          check_out_date: { gt: booking.check_in_date },
        },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'Có phòng đã được đặt trong khoảng thời gian này',
      );
    }

    // Tính số đêm
    const nights = Math.ceil(
      (booking.check_out_date.getTime() - booking.check_in_date.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Tính tổng tiền phòng
    const totalRoomPrice = booking.booking_rooms.reduce(
      (sum, br) => sum + Number(br.price_per_night) * nights,
      0,
    );

    // Tính tổng tiền dịch vụ
    const totalServicePrice = booking.booking_services.reduce(
      (sum, bs) => sum + Number(bs.total_price),
      0,
    );

    const totalAmount = totalRoomPrice + totalServicePrice;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: 'confirmed' },
      });

      await tx.invoice.create({
        data: {
          booking_id: id,
          total_amount: totalAmount,
          discount: 0,
          final_amount: totalAmount,
          status: 'unpaid',
        },
      });
    });

    const result = await this.findOne(id);

    const customerEmail =
      result.customer.email ??
      (
        await this.prisma.customer.findUnique({
          where: { id: result.customer.id },
          include: { account: true },
        })
      )?.account?.email;

    if (customerEmail) {
      this.mailService
        .sendBookingConfirmed(customerEmail, {
          customerName: result.customer.full_name,
          bookingId: result.id,
          checkInDate: new Date(result.check_in_date).toLocaleDateString(
            'vi-VN',
          ),
          checkOutDate: new Date(result.check_out_date).toLocaleDateString(
            'vi-VN',
          ),
          nights: result.nights,
          rooms: result.rooms.map((r) => ({
            roomNumber: r.room_number,
            roomType: r.room_type_name,
            // pricePerNight: r.price_per_night.toLocaleString('vi-VN'),
            pricePerNight: r.price_per_night,
          })),
          // totalAmount: result.total_room_price.toLocaleString('vi-VN'),
          totalAmount: result.total_room_price,
          // specialRequests: result.special_requests ?? undefined,
          hotelName: process.env.HOTEL_NAME,
          hotelPhone: process.env.HOTEL_PHONE,
          hotelAddress: process.env.HOTEL_ADDRESS,
        })
        .catch(() => {});
    }

    return result;
  }

  // ==================== CHECK-IN ====================
  async checkIn(
    id: string,
    accountId: string,
    files?: {
      front_image?: Express.Multer.File[];
      back_image?: Express.Multer.File[];
    },
  ): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    if (booking.status !== 'confirmed') {
      throw new BadRequestException(
        'Chỉ có thể check-in booking đã được confirm',
      );
    }

    let customer = booking.customer;
    let frontUrl = customer.id_card_img_url;
    let backUrl = customer.id_card_img_back_url;

    // Xử lý upload ảnh nếu có file và chưa có ảnh
    if (files?.front_image?.[0] && !frontUrl) {
      frontUrl = await this.s3Service.uploadFile(
        files.front_image[0],
        'customers/id-cards',
      );
    }
    if (files?.back_image?.[0] && !backUrl) {
      backUrl = await this.s3Service.uploadFile(
        files.back_image[0],
        'customers/id-cards',
      );
    }

    // Cập nhật customer nếu có ảnh mới
    if (
      (frontUrl && frontUrl !== customer.id_card_img_url) ||
      (backUrl && backUrl !== customer.id_card_img_back_url)
    ) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          ...(frontUrl && { id_card_img_url: frontUrl }),
          ...(backUrl && { id_card_img_back_url: backUrl }),
        },
      });
    }

    // Sau khi cập nhật, kiểm tra lại điều kiện bắt buộc
    if (!customer.id_card_img_url || !customer.id_card_img_back_url) {
      throw new BadRequestException(
        'Cần cung cấp ảnh CCCD mặt trước và mặt sau để check-in',
      );
    }

    // ← Fix 7: Kiểm tra ngày check-in
    const now = new Date();
    const checkOutDate = new Date(booking.check_out_date);
    const checkInDate = new Date(booking.check_in_date);

    // Cho phép check-in sớm 1 ngày
    const earliestCheckIn = new Date(checkInDate);
    earliestCheckIn.setDate(earliestCheckIn.getDate() - 1);

    if (now < earliestCheckIn) {
      throw new BadRequestException(
        `Chưa đến ngày check-in (${checkInDate.toLocaleDateString('vi-VN')})`,
      );
    }

    if (now >= checkOutDate) {
      throw new BadRequestException(
        'Đã quá ngày check-out, không thể check-in',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          status: 'checked_in',
          actual_check_in: now,
        },
      });

      const bookingRooms = await tx.bookingRoom.findMany({
        where: { booking_id: id },
        select: { room_id: true },
      });

      const roomIds = bookingRooms.map((br) => br.room_id);

      await tx.room.updateMany({
        where: { id: { in: roomIds } },
        data: { status: 'occupied' },
      });

      // ← Fix 5: Ghi RoomStatusHistory
      await this.createRoomStatusHistory(
        tx,
        roomIds,
        'available',
        'occupied',
        accountId,
      );
    });

    return this.findOne(id);
  }
  // ==================== CHECK-OUT ====================
  async checkOut(id: string, accountId: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { invoices: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    if (booking.status !== 'checked_in') {
      throw new BadRequestException(
        'Chỉ có thể check-out booking đang checked_in',
      );
    }

    // Check invoice đã thanh toán chưa
    const invoice = booking.invoices[0];
    if (invoice && invoice.status !== 'paid') {
      throw new BadRequestException(
        'Vui lòng thanh toán hóa đơn trước khi check-out',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.booking.update({
        where: { id },
        data: {
          status: 'checked_out',
          actual_check_out: now,
          // check_out_date: now, // ← cập nhật ngày dự kiến = ngày thực tế
        },
      });

      const bookingRooms = await tx.bookingRoom.findMany({
        where: { booking_id: id },
        select: { room_id: true },
      });

      const roomIds = bookingRooms.map((br) => br.room_id);

      await tx.room.updateMany({
        where: { id: { in: roomIds } },
        data: { status: 'cleaning' },
      });

      // ← Fix 5: Ghi RoomStatusHistory
      await this.createRoomStatusHistory(
        tx,
        roomIds,
        'occupied',
        'cleaning',
        accountId,
      );
    });

    return this.findOne(id);
  }

  // ==================== CANCEL ====================
  async cancel(id: string, accountId: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new BadRequestException(
        'Chỉ có thể hủy booking ở trạng thái pending hoặc confirmed',
      );
    }

    // Customer chỉ hủy booking của mình
    const customer = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
    });

    if (customer && booking.customer_id !== customer.id) {
      throw new ForbiddenException('Bạn không có quyền hủy booking này');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // Hủy invoice nếu có
      await tx.invoice.updateMany({
        where: { booking_id: id },
        data: { status: 'unpaid' },
      });

      const bookingRooms = await tx.bookingRoom.findMany({
        where: { booking_id: id },
        select: { room_id: true },
      });

      const roomIds = bookingRooms.map((br) => br.room_id);

      // Chỉ đổi phòng nếu đang occupied
      const occupiedRooms = await tx.room.findMany({
        where: {
          id: { in: roomIds },
          status: 'occupied',
        },
        select: { id: true },
      });

      if (occupiedRooms.length > 0) {
        const occupiedIds = occupiedRooms.map((r) => r.id);

        await tx.room.updateMany({
          where: { id: { in: occupiedIds } },
          data: { status: 'available' },
        });

        // ← Fix 5: Ghi RoomStatusHistory
        await this.createRoomStatusHistory(
          tx,
          occupiedIds,
          'occupied',
          'available',
          accountId,
        );
      }
    });

    return this.findOne(id);
  }

  // ==================== HELPERS ====================
  private async createRoomStatusHistory(
    tx: any,
    roomIds: string[],
    oldStatus: string,
    newStatus: string,
    accountId: string,
  ) {
    await tx.roomStatusHistory.createMany({
      data: roomIds.map((roomId) => ({
        room_id: roomId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: accountId,
        changed_at: new Date(),
      })),
    });
  }

  private bookingSelect() {
    return {
      id: true,
      booking_type: true,
      status: true,
      check_in_date: true,
      check_out_date: true,
      actual_check_in: true,
      actual_check_out: true,
      // special_requests: true,
      created_at: true,
      updated_at: true,
      customer: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
        },
      },
      booking_rooms: {
        select: {
          price_per_night: true,
          room: {
            select: {
              id: true,
              room_number: true,
              floor: true,
              room_type: {
                select: { name: true },
              },
            },
          },
        },
      },
      invoices: {
        select: {
          id: true,
          total_amount: true,
          discount: true,
          final_amount: true,
          status: true,
        },
      },
    };
  }

  private transformBooking(booking: any): BookingResponseDto {
    const nights = Math.ceil(
      (new Date(booking.check_out_date).getTime() -
        new Date(booking.check_in_date).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const totalRoomPrice = booking.booking_rooms.reduce(
      (sum: number, br: any) => sum + Number(br.price_per_night) * nights,
      0,
    );

    const invoice = booking.invoices[0] ?? null;

    return {
      id: booking.id,
      booking_type: booking.booking_type,
      status: booking.status,
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      actual_check_in: booking.actual_check_in,
      actual_check_out: booking.actual_check_out,
      // special_requests: booking.special_requests,
      nights,
      // ← Fix 9: ưu tiên lấy từ invoice
      total_room_price: totalRoomPrice,
      customer: {
        id: booking.customer.id,
        full_name: `${booking.customer.last_name} ${booking.customer.first_name}`,
        phone: booking.customer.phone,
        email: booking.customer.email,
      },
      rooms: booking.booking_rooms.map((br: any) => ({
        id: br.room.id,
        room_number: br.room.room_number,
        room_type_name: br.room.room_type.name,
        price_per_night: Number(br.price_per_night),
        floor: br.room.floor,
      })),
      invoice: invoice
        ? {
            id: invoice.id,
            total_amount: Number(invoice.total_amount),
            discount: Number(invoice.discount),
            final_amount: Number(invoice.final_amount),
            status: invoice.status,
          }
        : null,
      created_at: booking.created_at,
      updated_at: booking.updated_at,
    };
  }

  // Private method kiểm tra ownership
  private async checkBookingOwnership(
    bookingId: string,
    accountId: string,
    roles: string[],
  ): Promise<void> {
    // Nếu không phải customer, không cần kiểm tra (admin/staff được phép)
    if (!roles.includes('customer')) {
      return;
    }

    // Lấy booking và customer tương ứng
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customer_id: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });

    if (!customer || booking.customer_id !== customer.id) {
      throw new ForbiddenException('Bạn không có quyền truy cập booking này');
    }
  }
}
