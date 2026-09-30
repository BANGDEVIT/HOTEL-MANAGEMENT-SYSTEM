import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory, ServiceUnit } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** "  Giặt   ủi " -> "Giặt ủi": bỏ khoảng trắng thừa để kiểm tra trùng tên cho đúng */
const cleanName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateServiceDto {
  @ApiProperty({ example: 'Giặt ủi', maxLength: 100 })
  @Transform(cleanName)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên dịch vụ' })
  @MaxLength(100, { message: 'Tên dịch vụ tối đa 100 ký tự' })
  name: string;

  @ApiProperty({ enum: ServiceCategory, example: ServiceCategory.laundry })
  @IsEnum(ServiceCategory, { message: 'Nhóm dịch vụ không hợp lệ' })
  category: ServiceCategory;

  @ApiProperty({
    enum: ServiceUnit,
    example: ServiceUnit.kg,
    description: 'Đơn vị tính',
  })
  @IsEnum(ServiceUnit, { message: 'Đơn vị tính không hợp lệ' })
  unit: ServiceUnit;

  @ApiProperty({ example: 50000, description: 'Đơn giá (VNĐ), số nguyên' })
  @Type(() => Number)
  @IsInt({ message: 'Đơn giá phải là số nguyên' })
  @Min(0, { message: 'Đơn giá không được âm' })
  @Max(100_000_000, { message: 'Đơn giá quá lớn' })
  price: number;
}
