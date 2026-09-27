import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LinkAccountDto {
  @ApiProperty({
    example: 'khoa.tran@gmail.com',
    description: 'Email đăng nhập',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Nhập email' })
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: '8–72 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu ít nhất 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password: string;
}
