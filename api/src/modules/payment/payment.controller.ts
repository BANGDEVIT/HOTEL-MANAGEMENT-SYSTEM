import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/role-decorator';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { InvoiceDetailDto } from '../invoice/dto/invoice-response.dto';

/** Chỉ nhận UUID v4, sai định dạng -> 400 trước khi chạm DB */
const Uuid = (name: string) => Param(name, new ParseUUIDPipe({ version: '4' }));

/**
 * Phiếu thu.
 *   POST  /payments           thu tiền (tạm ứng khi đang ở / thu nợ sau trả phòng)
 *   PATCH /payments/:id/void  quản lý huỷ phiếu nhập nhầm
 * Thu + huỷ đều trả về CHI TIẾT HOÁ ĐƠN mới nhất -> FE thay luôn, không gọi lại.
 *
 * THỨ TỰ ROUTE: /invoice/:invoiceId phải khai báo TRƯỚC /:id.
 */
@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles('staff', 'manager', 'admin')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Thu tiền cho hoá đơn',
    description:
      'Tạm ứng khi khách đang ở hoặc thu nợ sau khi trả phòng. Không vượt quá số còn phải trả. ' +
      'Chuyển khoản / ví điện tử bắt buộc có mã giao dịch. Lúc trả phòng dùng POST /bookings/:id/check-out.',
  })
  @ApiResponse({ status: 201, type: InvoiceDetailDto })
  @ApiResponse({
    status: 400,
    description:
      'Vượt số còn lại / đã thu đủ / booking chưa nhận phòng / thiếu mã GD',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoá đơn' })
  create(
    @Body() dto: CreatePaymentDto,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<InvoiceDetailDto> {
    return this.paymentService.create(dto, { accountId, roles: roles ?? [] });
  }

  @Patch(':id/void')
  @Roles('manager', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Huỷ phiếu thu nhập nhầm',
    description:
      'Không xoá phiếu: ghi ai huỷ, lúc nào, lý do; hoá đơn được tính lại trạng thái',
  })
  @ApiParam({ name: 'id', description: 'UUID của phiếu thu' })
  @ApiResponse({ status: 200, type: InvoiceDetailDto })
  @ApiResponse({ status: 400, description: 'Phiếu đã huỷ trước đó' })
  @ApiResponse({ status: 403, description: 'Không phải quản lý' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiếu thu' })
  void(
    @Uuid('id') id: string,
    @Body() dto: VoidPaymentDto,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<InvoiceDetailDto> {
    return this.paymentService.void(id, dto.reason, {
      accountId,
      roles: roles ?? [],
    });
  }

  @Get('invoice/:invoiceId')
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Các phiếu thu của 1 hoá đơn (kể cả phiếu đã huỷ)' })
  @ApiParam({ name: 'invoiceId', description: 'UUID của hoá đơn' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  findByInvoice(
    @Uuid('invoiceId') invoiceId: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<PaymentResponseDto[]> {
    return this.paymentService.findByInvoice(invoiceId, {
      accountId,
      roles: roles ?? [],
    });
  }

  @Get(':id')
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Chi tiết 1 phiếu thu',
    description: 'Khách chỉ xem được phiếu của mình',
  })
  @ApiParam({ name: 'id', description: 'UUID của phiếu thu' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiếu thu' })
  findOne(
    @Uuid('id') id: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<PaymentResponseDto> {
    return this.paymentService.findOne(id, { accountId, roles: roles ?? [] });
  }
}
