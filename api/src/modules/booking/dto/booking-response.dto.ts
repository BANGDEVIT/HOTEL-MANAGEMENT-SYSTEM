import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BookingStatus,
  BookingType,
  InvoiceStatus,
  PaymentMethod,
} from '@prisma/client';
import { BOOKING_ACTIONS, type BookingAction } from '../booking.rules';

/* ============================================================
 *  PHẦN DÙNG CHUNG
 * ============================================================ */

export class BookingCustomerDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Trần Minh Khoa' }) full_name: string;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ description: 'Có tài khoản thành viên (được tích điểm)' })
  is_member: boolean;
}

export class BookingRoomDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: '302' }) room_number: string;
  @ApiProperty() floor: number;
  @ApiProperty({ example: 'Deluxe Double' }) room_type: string;
  @ApiProperty() capacity: number;
  @ApiProperty({
    example: 700000,
    description: 'Giá chốt lúc đặt, đổi giá loại phòng sau không ảnh hưởng',
  })
  price_per_night: number;
}

/* ============================================================
 *  DANH SÁCH
 * ============================================================ */

export class BookingListItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'BK-260929-0012' }) code: string;
  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty({ enum: BookingType }) booking_type: BookingType;
  @ApiProperty({ example: '2026-10-05' }) check_in_date: string;
  @ApiProperty({ example: '2026-10-07' }) check_out_date: string;
  @ApiProperty() nights: number;
  @ApiProperty() adults: number;
  @ApiProperty() children: number;
  @ApiProperty({ type: BookingCustomerDto }) customer: BookingCustomerDto;
  @ApiProperty({ type: BookingRoomDto, nullable: true })
  room: BookingRoomDto | null;

  @ApiProperty({
    description:
      'Có hoá đơn thì lấy tổng hoá đơn, chưa có thì tiền phòng dự kiến. Huỷ / không đến = 0',
  })
  amount: number;

  @ApiProperty({
    description:
      'Quá hạn: confirmed mà đã qua ngày nhận, hoặc checked_in mà đã qua ngày trả',
  })
  is_overdue: boolean;

  @ApiProperty() created_at: Date;
}

export class PaginatedBookingResponseDto {
  @ApiProperty({ type: [BookingListItemDto] }) data: BookingListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

/* ============================================================
 *  CHI TIẾT
 * ============================================================ */

export class BookingServiceItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Giặt ủi' }) name: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unit_price: number;
  @ApiProperty() total_price: number;
  @ApiProperty() used_at: Date;
  @ApiProperty({ nullable: true }) note: string | null;
}

export class BookingPaymentDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty({ enum: PaymentMethod }) payment_method: PaymentMethod;
  @ApiProperty({ nullable: true }) reference_number: string | null;
  @ApiProperty() paid_at: Date;
  @ApiProperty({
    nullable: true,
    description: 'Tên nhân viên thu. Khách xem thì luôn null',
  })
  received_by: string | null;
}

export class BookingInvoiceDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: InvoiceStatus }) status: InvoiceStatus;
  @ApiProperty() total_amount: number;
  @ApiProperty() discount: number;
  @ApiProperty() final_amount: number;
  @ApiProperty() paid_amount: number;
  @ApiProperty({ type: [BookingPaymentDto] }) payments: BookingPaymentDto[];
}

export const TIMELINE_EVENTS = [
  'created',
  'confirmed',
  'checked_in',
  'checked_out',
  'rejected',
  'cancelled',
  'no_show',
] as const;
export type TimelineEvent = (typeof TIMELINE_EVENTS)[number];

export class BookingTimelineDto {
  @ApiProperty({ enum: TIMELINE_EVENTS }) event: TimelineEvent;
  @ApiProperty() at: Date;
  @ApiProperty({
    nullable: true,
    example: 'Lê Thu Lan',
    description:
      'Người thực hiện. null = hệ thống / khách tự làm, hoặc khách đang xem',
  })
  by: string | null;
  @ApiPropertyOptional({ description: 'Lý do huỷ / từ chối' }) reason?: string;
}

export class BookingDetailDto extends BookingListItemDto {
  @ApiProperty({ nullable: true }) note: string | null;

  @ApiProperty({
    description: 'Đã có số giấy tờ chưa. Bước nhận phòng bắt buộc phải có',
  })
  customer_has_id_card: boolean;

  @ApiProperty({ example: 1400000 }) room_total: number;
  @ApiProperty({ example: 450000 }) service_total: number;

  @ApiProperty({ type: [BookingServiceItemDto] })
  services: BookingServiceItemDto[];
  @ApiProperty({ type: BookingInvoiceDto, nullable: true })
  invoice: BookingInvoiceDto | null;
  @ApiProperty({ type: [BookingTimelineDto] }) timeline: BookingTimelineDto[];

  @ApiProperty({
    enum: BOOKING_ACTIONS,
    isArray: true,
    description:
      'Nút được phép bấm với người đang xem, vào hôm nay. FE chỉ việc hiện theo danh sách này',
  })
  allowed_actions: BookingAction[];

  @ApiProperty() updated_at: Date;
}

/* ============================================================
 *  BÁO GIÁ & THỐNG KÊ
 * ============================================================ */

export class BookingQuoteDto {
  @ApiProperty({ type: BookingRoomDto }) room: BookingRoomDto;
  @ApiProperty() check_in_date: string;
  @ApiProperty() check_out_date: string;
  @ApiProperty() nights: number;
  @ApiProperty() price_per_night: number;
  @ApiProperty() room_total: number;
  @ApiProperty({
    description: 'false = đã có booking khác giữ phòng trong khoảng này',
  })
  available: boolean;
}

export class BookingStatsDto {
  @ApiProperty({ description: 'Yêu cầu online chờ duyệt' }) pending: number;
  @ApiProperty({ description: 'Tab "Đến": confirmed có ngày nhận <= hôm nay' })
  arrivals: number;
  @ApiProperty({ description: 'Trong số đó, lẽ ra đến từ hôm trước' })
  arrivals_overdue: number;
  @ApiProperty({ description: 'Đang ở' }) in_house: number;
  @ApiProperty({ description: 'Tab "Đi": đang ở có ngày trả <= hôm nay' })
  departures: number;
  @ApiProperty({ description: 'Trong số đó, đã quá ngày trả' })
  departures_overdue: number;
  @ApiProperty({ description: 'confirmed có ngày nhận > hôm nay' })
  upcoming: number;
  @ApiProperty({
    example: 42.5,
    description: '% phòng đang có khách / phòng đang kinh doanh',
  })
  occupancy_rate: number;
}
