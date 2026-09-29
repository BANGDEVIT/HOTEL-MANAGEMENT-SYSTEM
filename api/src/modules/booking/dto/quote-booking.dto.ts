import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YMD_MSG = 'Ngày phải có dạng YYYY-MM-DD';

/** GET /bookings/quote?room_id=...&check_in_date=...&check_out_date=...&adults=2 */
export class QuoteBookingDto {
  @ApiProperty()
  @IsUUID('4')
  room_id: string;

  @ApiProperty({ example: '2026-10-05' })
  @Matches(YMD, { message: YMD_MSG })
  check_in_date: string;

  @ApiProperty({ example: '2026-10-07' })
  @Matches(YMD, { message: YMD_MSG })
  check_out_date: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number) // query string luôn là chuỗi
  @IsInt()
  @Min(1)
  @Max(20)
  adults?: number = 1;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number = 0;
}
