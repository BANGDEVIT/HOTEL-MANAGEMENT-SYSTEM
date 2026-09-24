import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftName } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryShiftDTO {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number) // query string luôn là chuỗi -> ép sang số
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ShiftName })
  @IsOptional()
  @IsEnum(ShiftName, {
    message: 'Tên ca phải là morning, afternoon, evening hoặc night',
  })
  name?: ShiftName;
}
