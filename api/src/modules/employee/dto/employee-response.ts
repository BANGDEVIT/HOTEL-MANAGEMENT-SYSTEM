// api/src/modules/employee/dto/employee-response.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Thông tin tài khoản đính kèm trong response nhân viên.
 * roles được flatten từ account.role_account[].role.name ở transformEmployee()
 * -> FE nhận thẳng string[] thay vì phải lặn qua 2 tầng quan hệ.
 */
export class AccountInEmployeeDto {
  @ApiProperty({ example: 'b1f8c2d4-...' })
  id: string;

  @ApiProperty({ example: 'bang@hotel.com' })
  email: string;

  @ApiProperty({
    example: true,
    description: 'false = tài khoản đã bị khoá (xoá mềm)',
  })
  is_active: boolean;

  @ApiProperty({
    example: ['staff'],
    isArray: true,
    type: String,
    description: 'Danh sách tên role, đã flatten từ bảng role_account',
  })
  roles: string[];
}

/**
 * Response chuẩn cho 1 nhân viên (dùng cho findAll, findOne, create, update).
 * Giữ nguyên first_name / last_name để FE tự ghép (avatar chữ cái đầu, sort...).
 */
export class EmployeeResponseDto {
  @ApiProperty({ example: 'a3e1...' })
  id: string;

  @ApiProperty({ example: 'Bằng', description: 'Tên' })
  first_name: string;

  @ApiProperty({ example: 'Bùi Công', description: 'Họ và tên đệm' })
  last_name: string;

  @ApiProperty({
    example: 'Bùi Công Bằng',
    description: 'Ghép sẵn ở BE theo thứ tự tiếng Việt: last_name + first_name',
  })
  full_name: string;

  @ApiProperty({ example: 'bang@hotel.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '0909123456', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Lễ tân' })
  position: string;

  @ApiPropertyOptional({
    example: 'https://bucket.s3.ap-southeast-1.amazonaws.com/avatars/xxx.jpg',
    nullable: true,
  })
  avatar_url: string | null;

  @ApiProperty({
    example: 12000000,
    description: 'Đã convert Decimal -> number ở transformEmployee()',
  })
  salary: number;

  @ApiProperty({ example: '2024-03-01T00:00:00.000Z', type: Date })
  hired_date: Date;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'other'] })
  gender: string;

  @ApiProperty({ type: AccountInEmployeeDto })
  account: AccountInEmployeeDto;
}

/**
 * Response cho trang cá nhân (GET/PATCH /employees/profile).
 * Hiện tại shape giống hệt EmployeeResponseDto nên chỉ extends.
 * Tách class riêng để sau này thêm field đặc thù (vd: shifts_this_week,
 * leave_balance) mà không đụng vào response dùng chung.
 */
export class EmployeeProfileResponseDto extends EmployeeResponseDto {}

export class PaginatedEmployeeResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  data: EmployeeResponseDto[];

  @ApiProperty({ example: 42, description: 'Tổng số bản ghi khớp filter' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5, description: 'Math.ceil(total / limit)' })
  totalPages: number;
}
