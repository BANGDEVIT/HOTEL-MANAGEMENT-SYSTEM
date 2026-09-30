import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SERVICE_STATUSES = ['all', 'active', 'inactive'] as const;
export type ServiceStatusFilter = (typeof SERVICE_STATUSES)[number];

export const SERVICE_SORTS = ['usage', 'name', 'price', 'created_at'] as const;
export type ServiceSort = (typeof SERVICE_SORTS)[number];

export class QueryServiceDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number) // query string luôn là chuỗi -> ép sang số
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'giặt',
    description: 'Tìm theo tên, không phân biệt hoa thường',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({
    enum: SERVICE_STATUSES,
    default: 'all',
    description: 'Màn đặt phòng gửi "active" để chỉ lấy dịch vụ đang bán',
  })
  @IsOptional()
  @IsIn([...SERVICE_STATUSES])
  status?: ServiceStatusFilter = 'all';

  @ApiPropertyOptional({
    enum: SERVICE_SORTS,
    default: 'usage',
    description: 'usage = dùng nhiều nhất 30 ngày',
  })
  @IsOptional()
  @IsIn([...SERVICE_SORTS])
  sort?: ServiceSort = 'usage';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Bỏ trống = thứ tự hợp lý của từng kiểu sắp xếp',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
