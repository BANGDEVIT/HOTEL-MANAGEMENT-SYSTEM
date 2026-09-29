import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import { BookingService } from './booking.service';
import { CreateBookingDto, CreateMyBookingDto } from './dto/create-booking.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { QueryBookingDto, QueryMyBookingDto } from './dto/quey-booking.dto';
import {
  BookingDetailDto,
  BookingQuoteDto,
  BookingStatsDto,
  PaginatedBookingResponseDto,
} from './dto/booking-response.dto';

/** Chỉ nhận UUID v4, sai định dạng -> 400 trước khi chạm DB */
const BookingId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

/**
 * THỨ TỰ ROUTE QUAN TRỌNG: route cố định (/quote, /stats, /me) phải khai báo
 * TRƯỚC route có tham số (/:id), nếu không Nest hiểu "stats" là một :id.
 */
@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /* ============================== Dùng chung ============================== */

  @Get('quote')
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Báo giá + kiểm tra phòng còn trống',
    description:
      'Không ghi gì vào DB. FE gọi khi đổi ngày / số khách để hiện tổng tiền trước khi đặt',
  })
  @ApiResponse({ status: 200, type: BookingQuoteDto })
  @ApiResponse({
    status: 400,
    description: 'Ngày sai, quá sức chứa, phòng bảo trì / ngừng kinh doanh',
  })
  quote(@Query() query: QuoteBookingDto): Promise<BookingQuoteDto> {
    return this.bookingService.quote(query);
  }

  /* ============================== Khách hàng ============================== */

  @Get('me')
  @Roles('customer')
  @ApiOperation({ summary: 'Khách xem danh sách booking của mình' })
  @ApiResponse({ status: 200, type: PaginatedBookingResponseDto })
  findMine(
    @GetAccount('sub') accountId: string,
    @Query() query: QueryMyBookingDto,
  ): Promise<PaginatedBookingResponseDto> {
    return this.bookingService.findMine(accountId, query.page, query.limit);
  }

  @Get('me/:id')
  @Roles('customer')
  @ApiOperation({ summary: 'Khách xem chi tiết 1 booking của mình' })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ApiResponse({
    status: 404,
    description: 'Không có, hoặc là booking của người khác',
  })
  findMyOne(
    @GetAccount('sub') accountId: string,
    @BookingId() id: string,
  ): Promise<BookingDetailDto> {
    return this.bookingService.findMyOne(accountId, id);
  }

  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  @Roles('customer')
  @ApiOperation({
    summary: 'Khách tự đặt phòng online',
    description:
      'Tạo ở trạng thái pending, chờ lễ tân duyệt. Mỗi khách tối đa 3 yêu cầu đang chờ',
  })
  @ApiResponse({ status: 201, type: BookingDetailDto })
  @ApiResponse({
    status: 400,
    description: 'Ngày / số khách sai, hoặc đã có 3 yêu cầu đang chờ',
  })
  @ApiResponse({
    status: 409,
    description: 'Phòng đã có người đặt trong khoảng ngày này',
  })
  createMine(
    @GetAccount('sub') accountId: string,
    @Body() dto: CreateMyBookingDto,
  ): Promise<BookingDetailDto> {
    return this.bookingService.createByCustomer(accountId, dto);
  }

  /* ============================== Nhân viên ============================== */

  @Get('stats')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Số lượng trên các tab + công suất phòng' })
  @ApiResponse({ status: 200, type: BookingStatsDto })
  getStats(): Promise<BookingStatsDto> {
    return this.bookingService.getStats();
  }

  @Get()
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Danh sách booking theo tab, lọc, tìm kiếm' })
  @ApiResponse({ status: 200, type: PaginatedBookingResponseDto })
  findAll(
    @Query() query: QueryBookingDto,
  ): Promise<PaginatedBookingResponseDto> {
    return this.bookingService.findAll(query);
  }

  @Get(':id')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary:
      'Chi tiết booking: phòng, dịch vụ, hoá đơn, lịch sử, nút được phép bấm',
  })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  findOne(
    @BookingId() id: string,
    @GetAccount('roles') roles: string[],
  ): Promise<BookingDetailDto> {
    return this.bookingService.findOne(id, roles);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Lễ tân tạo booking (tại quầy / qua điện thoại)',
    description:
      'Xác nhận luôn (confirmed). Khách mới thì tạo hồ sơ ở /customers trước',
  })
  @ApiResponse({ status: 201, type: BookingDetailDto })
  @ApiResponse({
    status: 403,
    description: 'Tài khoản chưa gắn hồ sơ nhân viên',
  })
  @ApiResponse({
    status: 409,
    description: 'Trùng lịch, báo kèm mã booking đang giữ phòng',
  })
  create(
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDetailDto> {
    return this.bookingService.createByStaff(accountId, roles, dto);
  }
}
