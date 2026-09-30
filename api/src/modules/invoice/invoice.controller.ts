import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import { InvoiceService } from './invoice.service';
import { InvoiceStatsQueryDto, QueryInvoiceDto } from './dto/query-invoice.dto';
import {
  InvoiceDetailDto,
  InvoiceStatsDto,
  PaginatedInvoiceResponseDto,
} from './dto/invoice-response.dto';

/** Chỉ nhận UUID v4, sai định dạng -> 400 trước khi chạm DB */
const Uuid = (name: string) => Param(name, new ParseUUIDPipe({ version: '4' }));

/**
 * Hoá đơn CHỈ ĐỌC ở đây. Hoá đơn được tạo / tính lại ở module Booking:
 *   nhận phòng -> mở hoá đơn; thêm dịch vụ / giảm giá -> tính lại; trả phòng -> thu nốt.
 * Thu tiền, huỷ phiếu thu nằm ở module Payment.
 *
 * THỨ TỰ ROUTE: /stats, /booking/:id phải khai báo TRƯỚC /:id,
 * nếu không Nest hiểu "stats" là một :id.
 */
@ApiTags('invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Danh sách hoá đơn',
    description: 'Tab: all / open (đang ở) / debt (công nợ) / paid',
  })
  @ApiResponse({ status: 200, type: PaginatedInvoiceResponseDto })
  findAll(
    @Query() query: QueryInvoiceDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    return this.invoiceService.findAll(query);
  }

  @Get('stats')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Thống kê thu tiền',
    description:
      'Thực thu theo kỳ (mặc định tháng này), theo phương thức, theo ngày; còn phải thu; công nợ; phiếu huỷ',
  })
  @ApiResponse({ status: 200, type: InvoiceStatsDto })
  stats(@Query() query: InvoiceStatsQueryDto): Promise<InvoiceStatsDto> {
    return this.invoiceService.stats(query);
  }

  @Get('booking/:bookingId')
  @HttpCode(HttpStatus.OK)
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Xem hoá đơn theo booking',
    description: 'Khách chỉ xem được hoá đơn của mình',
  })
  @ApiParam({ name: 'bookingId', description: 'UUID của booking' })
  @ApiResponse({ status: 200, type: InvoiceDetailDto })
  @ApiResponse({
    status: 404,
    description:
      'Booking chưa nhận phòng (chưa có hoá đơn) hoặc không phải của bạn',
  })
  findByBooking(
    @Uuid('bookingId') bookingId: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<InvoiceDetailDto> {
    return this.invoiceService.findByBooking(bookingId, {
      accountId,
      roles: roles ?? [],
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Chi tiết hoá đơn',
    description:
      'Dòng phòng, dịch vụ, giảm giá, mọi phiếu thu (kể cả phiếu đã huỷ) và các nút được phép',
  })
  @ApiParam({ name: 'id', description: 'UUID của hoá đơn' })
  @ApiResponse({ status: 200, type: InvoiceDetailDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoá đơn' })
  findOne(
    @Uuid('id') id: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<InvoiceDetailDto> {
    return this.invoiceService.findOne(id, { accountId, roles: roles ?? [] });
  }
}
