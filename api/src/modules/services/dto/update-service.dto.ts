import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';

/**
 * Sửa thông tin: gửi field nào sửa field đó.
 * Bật / tắt đang bán KHÔNG nằm ở đây mà có route riêng PATCH /services/:id/status
 * -> nút gạt trên bảng không vô tình gửi kèm tên / giá cũ.
 */
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class UpdateServiceStatusDto {
  @ApiProperty({
    example: false,
    description: 'true = đang bán, false = ngừng bán',
  })
  @IsBoolean({ message: 'is_active phải là true hoặc false' })
  is_active: boolean;
}
