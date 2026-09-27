import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'NewPassword@123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  new_password: string;
}

export class UpdatePasswordDto {
  @ApiProperty({
    example: 'Pasword@123',
  })
  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  curent_password: string;

  @ApiProperty({
    example: 'Password@123',
    description: '8–72 ký tự, có cả chữ, số, và kí tự đặc biệt',
  })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  // bcrypt chỉ dùng 72 byte đầu. Dài hơn thì phần sau bị bỏ qua mà không báo gì
  // -> chặn luôn để không ai đặt mật khẩu tưởng dài nhưng thực chất bị cắt
  @MaxLength(72, { message: 'Mật khẩu mới tối đa 72 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password muut contain at least one uppercase letter, one lowercase letter, one number and one special character ',
  })
  new_password: string;
}
