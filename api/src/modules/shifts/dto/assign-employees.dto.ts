import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ResponseShiftDto } from './response-shift.dto';

export const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class AssignEmployeeDto {
  @ApiProperty({
    type: [String],
    example: ['uuid-nhan-vien-1', 'uuid-nhan-vien-2'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Phải chọn ít nhất 1 nhân viên' })
  @ArrayUnique({ message: 'Danh sách nhân viên bị trùng' })
  @IsUUID('all', { each: true, message: 'Mã nhân viên không hợp lệ' })
  employee_ids: string[];

  @ApiProperty({ example: '2026-09-28', description: 'Ngày trực, YYYY-MM-DD' })
  @Matches(YMD_REGEX, { message: 'Ngày trực phải có dạng YYYY-MM-DD' })
  @IsDateString({}, { message: 'Ngày trực không hợp lệ' }) // chặn 2026-02-31
  work_date: string;
}

export class AssignedEmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyễn Thị Lan' })
  full_name: string;

  @ApiProperty({ example: 'Lễ tân' })
  position: string;
}

export class AssignEmployeeResponseDto {
  @ApiProperty({ type: ResponseShiftDto })
  shift: ResponseShiftDto;

  @ApiProperty({ example: '2026-09-28' })
  work_date: string;

  @ApiProperty({ example: 2, description: 'Số người vừa được xếp mới' })
  total_assigned: number;

  @ApiProperty({
    example: 1,
    description:
      'Số người đã có sẵn trong ca này ngày này, bỏ qua không tạo lại',
  })
  skipped: number;

  @ApiProperty({ type: [AssignedEmployeeDto] })
  employees: AssignedEmployeeDto[];
}
