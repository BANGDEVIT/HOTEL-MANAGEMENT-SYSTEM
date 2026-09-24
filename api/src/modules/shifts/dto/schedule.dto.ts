import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';
import { ResponseShiftDto } from './response-shift.dto';
import { YMD_REGEX } from './assign-employees.dto';

export class QueryScheduleDto {
  @ApiPropertyOptional({
    example: 'Lan',
    description: 'Tìm theo tên nhân viên',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '2026-09-28',
    description: 'Lọc đúng 1 ngày (YYYY-MM-DD). Không dùng cùng week',
  })
  @IsOptional()
  @Matches(YMD_REGEX, { message: 'work_date phải có dạng YYYY-MM-DD' })
  @IsDateString()
  work_date?: string;

  @ApiPropertyOptional({
    example: '2026-09-28',
    description:
      'Xem cả tuần: truyền 1 ngày bất kỳ trong tuần. Bỏ trống cả 2 = tuần hiện tại',
  })
  @IsOptional()
  @Matches(YMD_REGEX, { message: 'week phải có dạng YYYY-MM-DD' })
  @IsDateString()
  week?: string;
}

export class ScheduleEmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyễn Thị Lan' })
  full_name: string;

  @ApiProperty({ example: 'Lễ tân' })
  position: string;

  @ApiProperty({ nullable: true })
  avatar_url: string | null;
}

export class ScheduleItemDto {
  @ApiProperty({ description: 'id của EmployeeShift' })
  id: string;

  @ApiProperty({ example: '2026-09-28' })
  work_date: string;

  @ApiProperty({ type: ScheduleEmployeeDto })
  employee: ScheduleEmployeeDto;

  @ApiProperty({ type: ResponseShiftDto })
  shift: ResponseShiftDto;
}
