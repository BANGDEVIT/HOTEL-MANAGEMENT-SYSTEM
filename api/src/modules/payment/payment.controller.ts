// payment.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { Roles } from '../../common/decorators/role-decorator';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('staff', 'manager', 'admin')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo thanh toán cho hóa đơn' })
  @ApiResponse({
    status: 201,
    description: 'Thanh toán thành công',
    type: PaymentResponseDto,
  })
  async create(@Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    return this.paymentService.create(dto);
  }

  @Get(':id')
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Xem chi tiết thanh toán' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  async findOne(
    @Param('id') id: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<PaymentResponseDto> {
    // Lấy payment kèm invoice và booking để kiểm tra quyền
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            booking: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán');

    // Nếu là customer, kiểm tra quyền sở hữu booking
    if (roles.includes('customer')) {
      const customer = await this.prisma.customer.findUnique({
        where: { account_id: accountId },
        select: { id: true },
      });
      if (!customer || payment.invoice.booking.customer_id !== customer.id) {
        throw new ForbiddenException('Bạn không có quyền xem thanh toán này');
      }
    }
    // Staff/manager/admin được xem tất cả

    return this.paymentService.findOne(id);
  }

  @Get('invoice/:invoiceId')
  @Roles('customer', 'staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách thanh toán của hóa đơn' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  async findByInvoice(
    @Param('invoiceId') invoiceId: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<PaymentResponseDto[]> {
    // Kiểm tra quyền truy cập invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        booking: true,
      },
    });
    if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');

    if (roles.includes('customer')) {
      const customer = await this.prisma.customer.findUnique({
        where: { account_id: accountId },
        select: { id: true },
      });
      if (!customer || invoice.booking.customer_id !== customer.id) {
        throw new ForbiddenException(
          'Bạn không có quyền xem thanh toán của hóa đơn này',
        );
      }
    }

    return this.paymentService.findByInvoice(invoiceId);
  }
}
