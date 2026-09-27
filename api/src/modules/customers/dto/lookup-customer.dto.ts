import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { normalizeIdCard, normalizePhone } from './create-guest.dto';

/** Kiểm tra trùng trước khi tạo / sửa khách */
export class LookupCustomerDto {
  @ApiPropertyOptional({ example: '0909 123 456' })
  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '079203001234' })
  @IsOptional()
  @Transform(({ value }) => normalizeIdCard(value))
  @IsString()
  id_card?: string;

  @ApiPropertyOptional({
    description: 'Bỏ qua khách này (dùng khi đang SỬA hồ sơ của chính họ)',
  })
  @IsOptional()
  @IsUUID()
  exclude_id?: string;
}
