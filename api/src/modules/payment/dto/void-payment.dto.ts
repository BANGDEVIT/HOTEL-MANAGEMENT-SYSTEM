import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Huỷ phiếu thu: BẮT BUỘC ghi lý do để sau này đối soát */
export class VoidPaymentDto {
  @ApiProperty({
    example: 'Nhập nhầm số tiền, đã thu lại đúng số',
    minLength: 3,
    maxLength: 300,
  })
  // class-validator báo lỗi theo thứ tự NGƯỢC với khai báo -> IsString cuối cùng
  @Transform(trim)
  @MaxLength(300, { message: 'Lý do tối đa 300 ký tự' })
  @MinLength(3, { message: 'Lý do tối thiểu 3 ký tự' })
  @IsString({ message: 'Vui lòng nhập lý do huỷ phiếu' })
  reason: string;
}
