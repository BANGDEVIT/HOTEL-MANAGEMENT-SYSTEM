import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdType, PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : value;

/** Từ chối / huỷ: nhân viên BẮT BUỘC ghi lý do để sau này tra lại */
export class ReasonDto {
  @ApiProperty({
    example: 'Khách gọi báo đổi lịch',
    minLength: 3,
    maxLength: 300,
  })
  // class-validator báo lỗi theo thứ tự NGƯỢC với khai báo, filter lấy lỗi đầu tiên
  // -> để IsString cuối cùng thì thiếu lý do sẽ báo "Vui lòng nhập lý do"
  @Transform(trim)
  @MaxLength(300, { message: 'Lý do tối đa 300 ký tự' })
  @MinLength(3, { message: 'Lý do tối thiểu 3 ký tự' })
  @IsString({ message: 'Vui lòng nhập lý do' })
  reason: string;
}

/** Khách tự huỷ: lý do không bắt buộc */
export class OptionalReasonDto {
  @ApiPropertyOptional({ example: 'Đổi kế hoạch', maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  reason?: string;
}

/**
 * Nhận phòng: khách đã có số giấy tờ trong hồ sơ thì gửi body rỗng.
 * Chưa có (hoặc cần sửa) thì gửi kèm, BE lưu luôn vào hồ sơ khách.
 */
export class CheckInDto {
  @ApiPropertyOptional({ enum: IdType })
  @IsOptional()
  @IsEnum(IdType)
  id_type?: IdType;

  @ApiPropertyOptional({ example: '079203001234' })
  @IsOptional()
  @Transform(upperTrim)
  @IsString()
  @MaxLength(20)
  id_card?: string;
}

export class AddServiceDto {
  @ApiProperty()
  @IsUUID('4')
  service_id: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 99 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number = 1;

  @ApiPropertyOptional({ example: 'Trả phòng muộn tới 15h', maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class DiscountDto {
  @ApiProperty({
    example: 100000,
    description: 'Số tiền giảm (VNĐ), 0 = bỏ giảm giá',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount: number;
}

export class CheckOutDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiPropertyOptional({
    example: 'MOMO8693845325',
    description: 'Mã giao dịch. Tiền mặt thì bỏ trống',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}
