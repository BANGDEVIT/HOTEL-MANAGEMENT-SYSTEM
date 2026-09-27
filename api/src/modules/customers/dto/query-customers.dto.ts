import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Tình trạng lưu trú, TÍNH từ bảng Booking chứ không lưu ở Customer */
export const STAY_STATUSES = ['in_house', 'arriving', 'none'] as const;
export type StayStatus = (typeof STAY_STATUSES)[number];

export const CUSTOMER_SORTS = [
  'created_at',
  'name',
  'reward_points',
  'stays',
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export class QueryCustomerDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number) // query string luôn là chuỗi -> ép sang số
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

  @ApiPropertyOptional({
    example: 'Trần 0909',
    description:
      'Nhiều từ cách nhau dấu cách, MỖI từ phải khớp tên, họ, SĐT, email hoặc số giấy tờ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'Việt Nam' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({
    enum: ['member', 'guest'],
    description: 'member = có tài khoản, guest = vãng lai',
  })
  @IsOptional()
  @IsIn(['member', 'guest'])
  membership?: 'member' | 'guest';

  @ApiPropertyOptional({
    type: String,
    example: 'in_house,arriving',
    description: 'Nhiều giá trị cách nhau dấu phẩy: in_house, arriving, none',
  })
  @IsOptional()
  // "in_house,arriving" -> ["in_house", "arriving"]
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsIn([...STAY_STATUSES], { each: true })
  stay?: StayStatus[];

  @ApiPropertyOptional({ enum: CUSTOMER_SORTS, default: 'created_at' })
  @IsOptional()
  @IsIn([...CUSTOMER_SORTS])
  sort?: CustomerSort = 'created_at';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
