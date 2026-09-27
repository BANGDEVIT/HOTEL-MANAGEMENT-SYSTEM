import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['role', 'password'] as const),
) {
  @ApiPropertyOptional({
    example: true,
    description: 'Kích hoạt/khoản',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Bang', description: 'Tên' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Bui', description: 'Họ' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: '0234852910', description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  phone?: string;

  // KHÔNG có avatar_url: ảnh chỉ được đổi bằng cách upload file, không cho client gửi thẳng một URL tự chọn
  // @ApiPropertyOptional({
  //   example:
  //     'https://my-bucket.s3.ap-southeast-1.amazonaws.com/avatars/user123.png',
  //   description: 'URL ảnh đại diện',
  // })
  // @IsOptional()
  // @IsUrl({}, { message: 'avatar_url không hợp lệ' })
  // avatar_url?: string;

  @ApiPropertyOptional({ example: 'male', enum: ['male', 'female', 'other'] })
  @IsOptional()
  @IsString()
  gender?: string;
}
