import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/* ============================================================
 * Helper dùng chung cho mọi DTO khách hàng
 * ============================================================ */

/** "0909 123 456" / "0909.123.456" -> "0909123456" */
export const normalizePhone = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\s.\-()]/g, '') : v;

/** "079 203 001 234" -> "079203001234", số hộ chiếu viết hoa */
export const normalizeIdCard = (v: unknown) =>
  typeof v === 'string' ? v.replace(/\s/g, '').toUpperCase() : v;

export const trimString = (v: unknown) =>
  typeof v === 'string' ? v.trim() : v;

/**
 * multipart/form-data gửi MỌI giá trị dưới dạng chuỗi: true -> "true".
 * @IsBoolean() sẽ từ chối "true" nếu không đổi về boolean trước.
 */
export const toBoolean = (v: unknown) => {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return v;
};

/** Số VN 10 số hoặc số quốc tế có dấu + (khách nước ngoài) */
export const PHONE_REGEX = /^\+?\d{9,15}$/;

/* ============================================================ */

export class CreateGuestDto {
  @ApiProperty({ example: 'Khoa', description: 'Tên' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên khách' })
  @MaxLength(50)
  first_name: string;

  @ApiProperty({ example: 'Trần Minh', description: 'Họ và tên đệm' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Nhập họ và tên đệm' })
  @MaxLength(50)
  last_name: string;

  @ApiProperty({ example: '0909123456' })
  @Transform(({ value }) => normalizePhone(value))
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @ApiPropertyOptional({ example: 'khoa.tran@gmail.com' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional({ enum: IdType, description: 'Bắt buộc nếu có id_card' })
  @IsOptional()
  @IsEnum(IdType, { message: 'Loại giấy tờ phải là cccd hoặc passport' })
  id_type?: IdType;

  // KHÔNG bắt buộc lúc tạo: khách gọi điện đặt trước chưa có giấy tờ.
  // Bắt buộc lúc CHECK-IN (kiểm tra ở booking service).
  @ApiPropertyOptional({
    example: '079203001234',
    description: 'CCCD 12 số hoặc số hộ chiếu',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeIdCard(value))
  @Matches(/^[A-Z0-9]{6,12}$/, { message: 'Số giấy tờ gồm 6–12 chữ hoặc số' })
  id_card?: string;

  @ApiPropertyOptional({ example: 'Việt Nam' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(50)
  nationality?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'true = vẫn tạo dù SĐT đã có hồ sơ khác (VD: người nhà dùng chung số). Số giấy tờ thì KHÔNG bao giờ được trùng.',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  allow_duplicate_phone?: boolean;
}
