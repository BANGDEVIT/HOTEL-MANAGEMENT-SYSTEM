import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Thu tiền cho 1 hoá đơn: tạm ứng khi khách đang ở, hoặc thu nợ sau khi đã trả phòng.
 * Lúc trả phòng thì KHÔNG dùng API này: POST /bookings/:id/check-out tự thu phần còn lại.
 */
export class CreatePaymentDto {
  @ApiProperty({ description: 'UUID của hoá đơn' })
  @IsNotEmpty({ message: 'invoice_id không được để trống' })
  @IsUUID('4', { message: 'invoice_id không hợp lệ' })
  invoice_id: string;

  @ApiProperty({
    example: 500000,
    description: 'Số tiền (VND, số nguyên), không vượt quá số còn phải trả',
  })
  @Type(() => Number)
  @IsInt({ message: 'Số tiền phải là số nguyên (VND)' })
  @Min(1000, { message: 'Số tiền tối thiểu 1.000đ' })
  amount: number;

  @ApiProperty({ example: 'cash', enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Phương thức thanh toán không hợp lệ' })
  payment_method: PaymentMethod;

  @ApiPropertyOptional({
    example: 'FT26093012345',
    description:
      'Mã giao dịch: bắt buộc với chuyển khoản và ví điện tử, tiền mặt bỏ trống',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Mã giao dịch tối đa 100 ký tự' })
  reference_number?: string;

  @ApiPropertyOptional({ example: 'Khách tạm ứng trước 2 đêm', maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: 'Ghi chú tối đa 300 ký tự' })
  note?: string;
}
