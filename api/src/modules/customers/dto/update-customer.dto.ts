import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { CreateGuestDto, toBoolean } from './create-guest.dto';

/**
 * Nhân viên sửa hồ sơ khách.
 * PartialType (của @nestjs/swagger) chép lại toàn bộ validator + @Transform
 * của CreateGuestDto và biến mọi field thành tuỳ chọn -> không phải viết lại.
 */
export class UpdateCustomerDto extends PartialType(CreateGuestDto) {
  @ApiPropertyOptional({ example: 1200, description: 'CHỈ quản lý / admin' })
  @IsOptional()
  @Type(() => Number) // multipart gửi "1200" -> 1200
  @IsInt({ message: 'Điểm thưởng phải là số nguyên' })
  @Min(0)
  reward_points?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Khoá / mở khoá tài khoản. CHỈ quản lý / admin, CHỈ khách có tài khoản',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  is_active?: boolean;
}
