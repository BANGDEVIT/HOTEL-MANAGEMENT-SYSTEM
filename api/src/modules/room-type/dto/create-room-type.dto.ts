import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BedType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Chuỗi rỗng -> null: người dùng xoá hết mô tả thì lưu null, không lưu "" */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Tiện nghi TRONG PHÒNG. Key lưu vào cột Json amenities, FE hiển thị nhãn tiếng Việt */
export enum Amenity {
  WIFI = 'wifi',
  TV = 'tv',
  AIR_CONDITIONING = 'air_conditioning',
  MINIBAR = 'minibar',
  BALCONY = 'balcony',
  POOL = 'pool',
  GYM = 'gym',
  BREAKFAST = 'breakfast',
  PARKING = 'parking',
  SAFE = 'safe', // két sắt
  HAIR_DRYER = 'hair_dryer',
  BATHTUB = 'bathtub', // bồn tắm
  CITY_VIEW = 'city_view', // view thành phố
  KITCHEN = 'kitchen', // bếp nhỏ
}

export class CreateRoomTypeDto {
  @ApiProperty({
    example: 'Deluxe',
    description: 'Tên loại phòng, không trùng (không phân biệt hoa thường)',
  })
  @Transform(trim)
  @MaxLength(50, { message: 'Tên loại phòng tối đa 50 ký tự' })
  @IsNotEmpty({ message: 'Tên loại phòng không được để trống' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'double', enum: BedType, description: 'Loại giường' })
  @IsEnum(BedType, { message: 'Loại giường không hợp lệ' })
  bed_type: BedType;

  @ApiProperty({
    example: 800000,
    description: 'Giá 1 đêm (VND). Chỉ áp dụng cho booking tạo sau khi đổi',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá phải là số' })
  @Min(0, { message: 'Giá không được âm' })
  @Max(1_000_000_000, { message: 'Giá quá lớn' })
  base_price: number;

  @ApiProperty({
    example: 2,
    description: 'Sức chứa (người lớn + trẻ từ 6 tuổi)',
  })
  @Type(() => Number)
  @IsInt({ message: 'Sức chứa phải là số nguyên' })
  @Min(1, { message: 'Sức chứa tối thiểu 1 người' })
  @Max(20, { message: 'Sức chứa tối đa 20 người' })
  capacity: number;

  @ApiPropertyOptional({
    example: ['wifi', 'tv', 'air_conditioning'],
    enum: Amenity,
    isArray: true,
    description: 'Danh sách tiện nghi',
  })
  @IsOptional()
  @IsArray({ message: 'Tiện nghi phải là mảng' })
  @ArrayUnique({ message: 'Tiện nghi bị trùng' })
  @IsEnum(Amenity, { each: true, message: 'Tiện nghi không hợp lệ' })
  amenities?: Amenity[] = [];

  @ApiPropertyOptional({
    example: 28,
    nullable: true,
    description: 'Diện tích m²',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Diện tích phải là số nguyên (m²)' })
  @Min(5, { message: 'Diện tích tối thiểu 5 m²' })
  @Max(1000, { message: 'Diện tích tối đa 1000 m²' })
  area?: number | null;

  @ApiPropertyOptional({
    example: 'Phòng 2 giường đơn, cửa sổ nhìn ra phố, phù hợp bạn bè đi cùng.',
    nullable: true,
    maxLength: 1000,
  })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(1000, { message: 'Mô tả tối đa 1000 ký tự' })
  description?: string | null;
}
