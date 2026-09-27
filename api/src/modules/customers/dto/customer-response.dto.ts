import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, CustomerSource, IdType } from '@prisma/client';
import { STAY_STATUSES, type StayStatus } from './query-customers.dto';

/* ============================================================
 * 1 dòng trong danh sách — KHÔNG có số giấy tờ đầy đủ
 * ============================================================ */
export class CustomerListItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Khoa' }) first_name: string;
  @ApiProperty({ example: 'Trần Minh' }) last_name: string;
  @ApiProperty({ example: 'Trần Minh Khoa' }) full_name: string;
  @ApiProperty({ example: '0909123456', nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ enum: IdType, nullable: true }) id_type: IdType | null;

  @ApiProperty({
    example: '1234',
    nullable: true,
    description: 'Chỉ 4 ký tự cuối. Số đầy đủ chỉ có ở API chi tiết',
  })
  id_card_last4: string | null;

  @ApiProperty({ example: 'Việt Nam', nullable: true }) nationality:
    | string
    | null;
  @ApiProperty({
    enum: CustomerSource,
    description: 'Nơi TẠO hồ sơ, không đổi sau này',
  })
  source: CustomerSource;

  @ApiProperty({ description: 'Có tài khoản thành viên hay không' })
  is_member: boolean;
  @ApiProperty({ nullable: true, description: 'Ngày liên kết tài khoản' })
  member_since: Date | null;
  @ApiProperty({ nullable: true, description: 'null = khách vãng lai' })
  account_active: boolean | null;

  @ApiProperty({ example: 1420 }) reward_points: number;
  @ApiProperty() created_at: Date;

  // ----- tính từ bảng Booking -----
  @ApiProperty({
    example: 6,
    description: 'Số lần đã ở (checked_in + checked_out)',
  })
  stays: number;
  @ApiProperty({ example: '2026-09-26', nullable: true }) last_stay_at:
    | string
    | null;
  @ApiProperty({ enum: STAY_STATUSES }) stay_status: StayStatus;
  @ApiProperty({ example: ['302'], type: [String] }) current_rooms: string[];
  @ApiProperty({ example: '2026-10-02', nullable: true }) next_arrival:
    | string
    | null;
}

export class PaginatedCustomerResponseDto {
  @ApiProperty({ type: [CustomerListItemDto] }) data: CustomerListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

/* ============================================================
 * Chi tiết 1 khách — có số giấy tờ đầy đủ, ảnh, tổng chi
 * ============================================================ */
export class AccountInCustomerDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() is_active: boolean;
}

export class CustomerDetailDto extends CustomerListItemDto {
  @ApiProperty({ example: '079203001234', nullable: true }) id_card:
    | string
    | null;
  @ApiProperty({ nullable: true }) id_card_img_url: string | null;
  @ApiProperty({ nullable: true }) id_card_img_back_url: string | null;
  @ApiPropertyOptional({ type: AccountInCustomerDto, nullable: true })
  account: AccountInCustomerDto | null;
  @ApiProperty({
    example: 14200000,
    description: 'Tổng tiền đã THANH TOÁN (từ bảng Payment)',
  })
  total_spent: number;
  @ApiProperty() updated_at: Date;
}

/* ============================================================
 * Kiểm tra trùng
 * ============================================================ */
export class CustomerLookupDto extends CustomerListItemDto {
  @ApiProperty({
    example: ['phone'],
    enum: ['phone', 'id_card'],
    isArray: true,
  })
  matched_by: ('phone' | 'id_card')[];
}

/* ============================================================
 * Thống kê cho 4 ô + số trên tab lọc
 * ============================================================ */
export class CustomerStatsDto {
  @ApiProperty({ example: 248 }) total: number;
  @ApiProperty({ example: 31 }) members: number;
  @ApiProperty({ example: 217 }) guests: number;
  @ApiProperty({ example: 18 }) in_house: number;
  @ApiProperty({
    example: 5,
    description: 'Có booking nhận phòng hôm nay, chưa check-in',
  })
  arriving_today: number;
  @ApiProperty({ example: 23 }) new_this_month: number;
  @ApiProperty({ example: 17 }) new_last_month: number;
  @ApiProperty({
    example: 34,
    description: '% khách đã ở ít nhất 1 lần mà quay lại từ lần 2',
  })
  returning_rate: number;
}

/* ============================================================
 * Lịch sử đặt phòng của 1 khách
 * ============================================================ */
export class CustomerBookingRoomDto {
  @ApiProperty({ example: '302' }) room_number: string;
  @ApiProperty({ example: 'Deluxe' }) room_type: string;
}

export class CustomerBookingDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty({ example: '2026-09-26' }) check_in_date: string;
  @ApiProperty({ example: '2026-09-28' }) check_out_date: string;
  @ApiProperty({ example: 2 }) nights: number;
  @ApiProperty({ type: [CustomerBookingRoomDto] })
  rooms: CustomerBookingRoomDto[];
  @ApiProperty({
    example: 2400000,
    description: 'Tiền hoá đơn, chưa có hoá đơn thì tính theo giá phòng',
  })
  amount: number;
}
