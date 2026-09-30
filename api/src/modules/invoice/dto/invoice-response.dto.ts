import { ApiProperty } from '@nestjs/swagger';
import {
  BookingStatus,
  BookingType,
  InvoiceStatus,
  PaymentMethod,
  ServiceUnit,
} from '@prisma/client';
import { INVOICE_ACTIONS, type InvoiceAction } from '../invoice.rules';

/* ============================================================
 *  DANH SÁCH
 * ============================================================ */

export class InvoiceBookingBriefDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'BK-260929-0012' }) code: string;
  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty({ example: '2026-09-27' }) check_in_date: string;
  @ApiProperty({ example: '2026-09-30' }) check_out_date: string;
  @ApiProperty() nights: number;
}

export class InvoiceCustomerBriefDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Trần Minh Khoa' }) full_name: string;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty() is_member: boolean;
}

export class InvoiceListItemDto {
  @ApiProperty() id: string;
  @ApiProperty({
    example: 'HD-260929-0012',
    description: 'Số hoá đơn, suy ra từ mã booking',
  })
  code: string;
  @ApiProperty({ enum: InvoiceStatus }) status: InvoiceStatus;
  @ApiProperty({ type: InvoiceBookingBriefDto })
  booking: InvoiceBookingBriefDto;
  @ApiProperty({ type: InvoiceCustomerBriefDto })
  customer: InvoiceCustomerBriefDto;
  @ApiProperty({ type: [String], example: ['302'] }) rooms: string[];
  @ApiProperty({ example: 2_450_000 }) total_amount: number;
  @ApiProperty({ example: 0 }) discount: number;
  @ApiProperty({ example: 2_450_000 }) final_amount: number;
  @ApiProperty({
    example: 1_000_000,
    description: 'Tổng các phiếu thu còn hiệu lực',
  })
  paid_amount: number;
  @ApiProperty({ example: 1_450_000 }) remaining: number;
  @ApiProperty({ description: 'Đã trả phòng mà còn thiếu tiền' })
  is_debt: boolean;
  @ApiProperty({
    enum: PaymentMethod,
    isArray: true,
    description: 'Các phương thức đã dùng (không tính phiếu huỷ)',
  })
  methods: PaymentMethod[];
  @ApiProperty({ nullable: true, description: 'Lần thu gần nhất' })
  last_paid_at: Date | null;
  @ApiProperty({ description: 'Ngày lập = lúc nhận phòng' }) created_at: Date;
}

export class PaginatedInvoiceResponseDto {
  @ApiProperty({ type: [InvoiceListItemDto] }) data: InvoiceListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

/* ============================================================
 *  THỐNG KÊ
 * ============================================================ */

export class AmountCountDto {
  @ApiProperty() amount: number;
  @ApiProperty() count: number;
}

export class MethodRevenueDto extends AmountCountDto {
  @ApiProperty({ enum: PaymentMethod }) method: PaymentMethod;
}

export class DailyRevenueDto {
  @ApiProperty({ example: '2026-09-29' }) date: string;
  @ApiProperty() amount: number;
}

export class InvoiceTabCountsDto {
  @ApiProperty() all: number;
  @ApiProperty() open: number;
  @ApiProperty() debt: number;
  @ApiProperty() paid: number;
}

export class InvoiceStatsDto {
  @ApiProperty({ example: '2026-09-01' }) from: string;
  @ApiProperty({ example: '2026-09-30' }) to: string;

  @ApiProperty({
    type: AmountCountDto,
    description: 'Tiền thực thu trong kỳ (theo ngày thu, không tính phiếu huỷ)',
  })
  collected: AmountCountDto;

  @ApiProperty({
    type: AmountCountDto,
    description: 'Cùng số ngày, kỳ liền trước -> FE tính % tăng giảm',
  })
  previous: AmountCountDto;

  @ApiProperty({
    type: [MethodRevenueDto],
    description: 'Luôn đủ 4 phương thức, xếp tiền nhiều trước',
  })
  by_method: MethodRevenueDto[];

  @ApiProperty({ type: [DailyRevenueDto] }) daily: DailyRevenueDto[];

  @ApiProperty({
    type: AmountCountDto,
    description: 'Khách đang ở: số hoá đơn và số tiền còn phải thu',
  })
  open: AmountCountDto;

  @ApiProperty({
    type: AmountCountDto,
    description: 'Công nợ: đã trả phòng mà còn thiếu (không phụ thuộc kỳ)',
  })
  debt: AmountCountDto;

  @ApiProperty({
    type: AmountCountDto,
    description: 'Phiếu thu bị huỷ trong kỳ (theo ngày huỷ)',
  })
  voided: AmountCountDto;

  @ApiProperty({ description: 'Tổng giảm giá của hoá đơn lập trong kỳ' })
  discount_total: number;

  @ApiProperty({ type: InvoiceTabCountsDto }) tabs: InvoiceTabCountsDto;
}

/* ============================================================
 *  CHI TIẾT
 * ============================================================ */

export class InvoiceRoomLineDto {
  @ApiProperty({ example: '302' }) room_number: string;
  @ApiProperty({ example: 'Deluxe' }) room_type: string;
  @ApiProperty() nights: number;
  @ApiProperty() price_per_night: number;
  @ApiProperty() amount: number;
}

export class InvoiceServiceLineDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Giặt ủi' }) name: string;
  @ApiProperty({ enum: ServiceUnit }) unit: ServiceUnit;
  @ApiProperty() quantity: number;
  @ApiProperty({ description: 'Giá lúc dùng, không đổi theo giá hiện tại' })
  unit_price: number;
  @ApiProperty() total_price: number;
  @ApiProperty() used_at: Date;
  @ApiProperty({ nullable: true }) note: string | null;
}

export class PaymentVoidInfoDto {
  @ApiProperty() at: Date;
  @ApiProperty({
    nullable: true,
    description: 'Tên quản lý huỷ. Khách xem thì null',
  })
  by: string | null;
  @ApiProperty({ nullable: true }) reason: string | null;
}

export class InvoicePaymentDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty({ enum: PaymentMethod }) payment_method: PaymentMethod;
  @ApiProperty({ nullable: true }) reference_number: string | null;
  @ApiProperty({ nullable: true }) note: string | null;
  @ApiProperty() paid_at: Date;
  @ApiProperty({
    nullable: true,
    description: 'Tên nhân viên thu. Khách xem thì null',
  })
  received_by: string | null;
  @ApiProperty({
    type: PaymentVoidInfoDto,
    nullable: true,
    description: 'null = phiếu còn hiệu lực',
  })
  voided: PaymentVoidInfoDto | null;
  @ApiProperty({ description: 'Người đang xem có huỷ được phiếu này không' })
  can_void: boolean;
}

export class InvoiceBookingDto extends InvoiceBookingBriefDto {
  @ApiProperty({ enum: BookingType }) booking_type: BookingType;
  @ApiProperty() adults: number;
  @ApiProperty() children: number;
  @ApiProperty({ nullable: true }) actual_check_in: Date | null;
  @ApiProperty({ nullable: true }) actual_check_out: Date | null;
  @ApiProperty({
    nullable: true,
    description: 'Nhân viên làm thủ tục trả phòng',
  })
  checked_out_by: string | null;
}

export class InvoiceCustomerDto extends InvoiceCustomerBriefDto {
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ nullable: true }) nationality: string | null;
}

export class InvoiceDetailDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'HD-260929-0012' }) code: string;
  @ApiProperty({ enum: InvoiceStatus }) status: InvoiceStatus;
  @ApiProperty({ type: InvoiceBookingDto }) booking: InvoiceBookingDto;
  @ApiProperty({ type: InvoiceCustomerDto }) customer: InvoiceCustomerDto;

  @ApiProperty({ type: [InvoiceRoomLineDto] }) rooms: InvoiceRoomLineDto[];
  @ApiProperty({ type: [InvoiceServiceLineDto] })
  services: InvoiceServiceLineDto[];

  @ApiProperty() room_total: number;
  @ApiProperty() service_total: number;
  @ApiProperty() total_amount: number;
  @ApiProperty() discount: number;
  @ApiProperty() final_amount: number;
  @ApiProperty() paid_amount: number;
  @ApiProperty() remaining: number;
  @ApiProperty() is_debt: boolean;

  @ApiProperty({
    type: [InvoicePaymentDto],
    description: 'Gồm cả phiếu đã huỷ (để đối soát), cũ trước mới sau',
  })
  payments: InvoicePaymentDto[];

  @ApiProperty({ enum: INVOICE_ACTIONS, isArray: true })
  allowed_actions: InvoiceAction[];
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
