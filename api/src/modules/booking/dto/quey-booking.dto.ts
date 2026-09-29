import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, BookingType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Các tab ở màn Đặt phòng. Mỗi tab = 1 câu hỏi lễ tân hay hỏi trong ca:
 *   pending    Có yêu cầu online nào chờ duyệt?
 *   arrivals   Hôm nay ai đến? (gồm cả khách lẽ ra đến hôm trước mà chưa tới)
 *   in_house   Ai đang ở?
 *   departures Hôm nay ai trả phòng? (gồm cả khách quá hạn trả)
 *   upcoming   Những ngày tới có ai đặt?
 *   history    Đã xong: trả phòng, huỷ, không đến
 *   all        Tất cả
 */
export const BOOKING_TABS = [
  'all',
  'pending',
  'arrivals',
  'in_house',
  'departures',
  'upcoming',
  'history',
] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

export const BOOKING_SORTS = [
  'created_at',
  'check_in_date',
  'check_out_date',
] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class QueryBookingDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: BOOKING_TABS, default: 'all' })
  @IsOptional()
  @IsIn([...BOOKING_TABS])
  tab?: BookingTab = 'all';

  @ApiPropertyOptional({
    type: String,
    example: 'confirmed,checked_in',
    description:
      'Lọc thêm theo trạng thái, nhiều giá trị cách nhau dấu phẩy. Kết hợp AND với tab',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsEnum(BookingStatus, { each: true })
  status?: BookingStatus[];

  @ApiPropertyOptional({ enum: BookingType })
  @IsOptional()
  @IsEnum(BookingType)
  booking_type?: BookingType;

  @ApiPropertyOptional({
    example: 'BK-2609 302',
    description: 'Mỗi từ phải khớp mã booking, tên / SĐT khách hoặc số phòng',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Lấy booking có ngày ở giao với [from, to)',
  })
  @IsOptional()
  @Matches(YMD, { message: 'from phải có dạng YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(YMD, { message: 'to phải có dạng YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({
    enum: BOOKING_SORTS,
    description: 'Bỏ trống = sắp xếp mặc định của từng tab',
  })
  @IsOptional()
  @IsIn([...BOOKING_SORTS])
  sort?: BookingSort;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

/** GET /bookings/me: khách chỉ cần phân trang */
export class QueryMyBookingDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
