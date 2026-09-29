import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YMD_MSG = 'Ngày phải có dạng YYYY-MM-DD';

/**
 * Khách tự đặt (POST /bookings/me): không gửi customer_id,
 * BE tự lấy hồ sơ khách từ token -> khách không đặt hộ người khác được.
 */
export class CreateMyBookingDto {
  @ApiProperty({ description: 'Phòng muốn đặt (1 booking = 1 phòng)' })
  @IsUUID('4')
  room_id: string;

  @ApiProperty({ example: '2026-10-05' })
  @Matches(YMD, { message: YMD_MSG })
  check_in_date: string;

  @ApiProperty({ example: '2026-10-07' })
  @Matches(YMD, { message: YMD_MSG })
  check_out_date: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults?: number = 1;

  @ApiPropertyOptional({
    default: 0,
    description: 'Chỉ đếm trẻ từ 6 tuổi, dưới 6 tuổi không tính',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number = 0;

  @ApiPropertyOptional({
    example: 'Đến khoảng 20h, cần tầng cao',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Nhân viên tạo tại quầy / qua điện thoại (POST /bookings): chọn khách có sẵn */
export class CreateBookingDto extends CreateMyBookingDto {
  @ApiProperty({
    description:
      'Khách đã có hồ sơ. Khách mới thì tạo hồ sơ trước ở /customers',
  })
  @IsUUID('4')
  customer_id: string;
}
