import {
  Body,
  Controller,
  createParamDecorator,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { type Actor, BookingActionsService } from './bookingActions.service';
import {
  AddServiceDto,
  CheckInDto,
  CheckOutDto,
  DiscountDto,
  OptionalReasonDto,
  ReasonDto,
} from './dto/booking-action.dto';
import { CreateBookingDto, CreateMyBookingDto } from './dto/create-booking.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { QueryBookingDto, QueryMyBookingDto } from './dto/quey-booking.dto';
import {
  BookingDetailDto,
  BookingQuoteDto,
  BookingStatsDto,
  HousekeepingResultDto,
  PaginatedBookingResponseDto,
} from './dto/booking-response.dto';

/** Chỉ nhận UUID v4, sai định dạng -> 400 trước khi chạm DB */
const BookingId = () => Param('id', new ParseUUIDPipe({ version: '4' }));
const STAFF = ['staff', 'manager', 'admin'] as const;

/**
 * { accountId, roles } của người đang gọi API, gom 2 lần @GetAccount('sub') + @GetAccount('roles') làm 1.
 * Đọc từ req.user giống GetAccount (JwtStrategy.validate trả về { sub, roles, ... }).
 */
const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor => {
    const user = ctx
      .switchToHttp()
      .getRequest<{ user: { sub: string; roles?: string[] } }>().user;
    return { accountId: user.sub, roles: user.roles ?? [] };
  },
);

/** Lỗi chung của các API thao tác, khai 1 lần */
const ACTION_ERRORS = [
  ApiResponse({
    status: 400,
    description: 'Sai trạng thái / sai ngày (vd nhận phòng trước ngày)',
  }),
  ApiResponse({
    status: 403,
    description: 'Không đủ quyền (vd staff huỷ booking đã xác nhận)',
  }),
  ApiResponse({ status: 404, description: 'Không tìm thấy booking' }),
];
const ActionErrors = (): MethodDecorator => (target, key, desc) => {
  ACTION_ERRORS.forEach((d) => d(target, key, desc));
};

/**
 * THỨ TỰ ROUTE QUAN TRỌNG: route cố định (/quote, /stats, /me) phải khai báo
 * TRƯỚC route có tham số (/:id), nếu không Nest hiểu "stats" là một :id.
 */
@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly actions: BookingActionsService,
  ) {}

  /** Thao tác xong trả về chi tiết mới nhất -> FE thay luôn vào drawer, không cần gọi lại */
  private async done(id: string, actor: Actor): Promise<BookingDetailDto> {
    return this.bookingService.findOne(id, actor.roles);
  }

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

  @Patch('me/:id/cancel')
  @Roles('customer')
  @ApiOperation({
    summary: 'Khách tự huỷ yêu cầu đang chờ duyệt',
    description: 'Đã được xác nhận thì phải gọi khách sạn',
  })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async cancelMine(
    @GetAccount('sub') accountId: string,
    @BookingId() id: string,
    @Body() dto: OptionalReasonDto,
  ): Promise<BookingDetailDto> {
    await this.actions.cancelMine(id, accountId, dto.reason);
    return this.bookingService.findMyOne(accountId, id);
  }

  /* ============================== Nhân viên ============================== */

  @Get('stats')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Số lượng trên các tab + công suất phòng' })
  @ApiResponse({ status: 200, type: BookingStatsDto })
  getStats(): Promise<BookingStatsDto> {
    return this.bookingService.getStats();
  }

  @Post('housekeeping/run')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({
    summary: 'Chạy tay việc dọn dẹp hằng ngày',
    description:
      'Cron tự chạy 12:05 mỗi ngày. Route này để test bằng Postman hoặc chạy bù khi server từng tắt',
  })
  @ApiResponse({ status: 200, type: HousekeepingResultDto })
  runHousekeeping(): Promise<HousekeepingResultDto> {
    return this.actions.runDailyHousekeeping();
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

  /* ============================== Thao tác ============================== */

  @Patch(':id/confirm')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Duyệt yêu cầu online (pending -> confirmed)' })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async confirm(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
  ): Promise<BookingDetailDto> {
    await this.actions.confirm(id, actor);
    return this.done(id, actor);
  }

  @Patch(':id/reject')
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Từ chối yêu cầu online (pending -> cancelled), bắt buộc lý do',
  })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async reject(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
    @Body() dto: ReasonDto,
  ): Promise<BookingDetailDto> {
    await this.actions.reject(id, actor, dto.reason);
    return this.done(id, actor);
  }

  @Patch(':id/cancel')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Quản lý huỷ booking đã xác nhận, bắt buộc lý do' })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async cancel(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
    @Body() dto: ReasonDto,
  ): Promise<BookingDetailDto> {
    await this.actions.cancel(id, actor, dto.reason);
    return this.done(id, actor);
  }

  @Patch(':id/no-show')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Đánh dấu khách không đến (sau ngày nhận phòng)' })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async markNoShow(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
  ): Promise<BookingDetailDto> {
    await this.actions.markNoShow(id, actor);
    return this.done(id, actor);
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Nhận phòng',
    description:
      'Cần số giấy tờ (có sẵn trong hồ sơ hoặc gửi kèm). Phòng phải đang trống và sạch. ' +
      'Tạo hoá đơn tiền phòng, phòng chuyển sang "có khách"',
  })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ApiResponse({
    status: 409,
    description:
      'Phòng chưa dọn / còn khách cũ, hoặc số giấy tờ trùng hồ sơ khác',
  })
  @ActionErrors()
  async checkIn(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
    @Body() dto: CheckInDto,
  ): Promise<BookingDetailDto> {
    await this.actions.checkIn(id, actor, dto);
    return this.done(id, actor);
  }

  @Post(':id/services')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Thêm dịch vụ khi khách đang ở (cũng dùng cho phụ thu trả muộn)',
  })
  @ApiResponse({ status: 201, type: BookingDetailDto })
  @ActionErrors()
  async addService(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
    @Body() dto: AddServiceDto,
  ): Promise<BookingDetailDto> {
    await this.actions.addService(id, actor, dto);
    return this.done(id, actor);
  }

  @Delete(':id/services/:itemId')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Xoá dịch vụ nhập nhầm (chỉ khi khách còn ở)' })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async removeService(
    @BookingId() id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @CurrentActor() actor: Actor,
  ): Promise<BookingDetailDto> {
    await this.actions.removeService(id, itemId, actor);
    return this.done(id, actor);
  }

  @Patch(':id/discount')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Quản lý đặt giảm giá cho hoá đơn (khi khách đang ở)',
  })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async setDiscount(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
    @Body() dto: DiscountDto,
  ): Promise<BookingDetailDto> {
    await this.actions.setDiscount(id, actor, dto.discount);
    return this.done(id, actor);
  }

  @Post(':id/check-out')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Trả phòng + thanh toán',
    description:
      'Thu toàn bộ số còn lại, chốt hoá đơn, cộng điểm (thành viên, 10.000đ = 1 điểm), phòng chuyển sang "đang dọn"',
  })
  @ApiResponse({ status: 200, type: BookingDetailDto })
  @ActionErrors()
  async checkOut(
    @BookingId() id: string,
    @CurrentActor() actor: Actor,
    @Body() dto: CheckOutDto,
  ): Promise<BookingDetailDto> {
    await this.actions.checkOut(id, actor, dto);
    return this.done(id, actor);
  }
}
