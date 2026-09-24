import { ApiProperty } from '@nestjs/swagger';
import { ShiftName } from '@prisma/client';

/** 1 ca làm — dùng chung cho create / update / nằm lồng trong response khác */
export class ResponseShiftDto {
  @ApiProperty({ example: '0f9c...' })
  id: string;

  @ApiProperty({ enum: ShiftName, example: ShiftName.morning })
  name: ShiftName;

  @ApiProperty({ example: '06:00' })
  start_time: string;

  @ApiProperty({ example: '14:00' })
  end_time: string;

  @ApiProperty({
    example: false,
    description: 'true khi end_time <= start_time, tức ca kéo qua nửa đêm',
  })
  is_overnight: boolean;
}

/** 1 dòng trong danh sách ca */
export class ShiftListItemDto extends ResponseShiftDto {
  @ApiProperty({
    example: 12,
    description: 'Số lượt phân công từ hôm nay trở đi',
  })
  upcoming_assignments: number;
}

export class PaginatedShiftResponseDto {
  @ApiProperty({ type: [ShiftListItemDto] })
  data: ShiftListItemDto[];

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

/** Nhân viên được xếp vào ca, kèm ngày trực */
export class ShiftEmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyễn Thị Lan' })
  full_name: string;

  @ApiProperty({ example: 'lan@hotel.local', nullable: true })
  email: string | null;

  @ApiProperty({ example: '0900000004' })
  phone: string;

  @ApiProperty({ nullable: true })
  avatar_url: string | null;

  @ApiProperty({ example: 'Lễ tân' })
  position: string;

  @ApiProperty({ example: 'female' })
  gender: string;

  @ApiProperty({ example: '2026-09-28' })
  work_date: string;
}

/** Chi tiết 1 ca: thông tin ca + danh sách phân công sắp tới */
export class ShiftDetailResponseDto extends ResponseShiftDto {
  @ApiProperty({ example: 5 })
  total_upcoming: number;

  @ApiProperty({
    type: [ShiftEmployeeDto],
    description: 'Các lượt phân công từ hôm nay trở đi, sắp theo ngày',
  })
  upcoming: ShiftEmployeeDto[];
}
