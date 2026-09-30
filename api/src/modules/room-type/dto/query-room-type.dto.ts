import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** GET /room-types (công khai): chỉ loại phòng đang kinh doanh */
export class QueryRoomTypeDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number) // query string luôn là chuỗi -> đổi sang số trước khi kiểm tra
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Deluxe', description: 'Tìm theo tên' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
