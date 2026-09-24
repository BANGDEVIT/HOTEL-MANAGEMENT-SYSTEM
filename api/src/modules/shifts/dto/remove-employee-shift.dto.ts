import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';
import { YMD_REGEX } from './assign-employees.dto';

export class RemoveEmployeeQueryDto {
  @ApiProperty({ example: '2026-09-28', description: 'Ngày trực, YYYY-MM-DD' })
  @Matches(YMD_REGEX, { message: 'Ngày trực phải có dạng YYYY-MM-DD' })
  @IsDateString({}, { message: 'Ngày trực không hợp lệ' })
  work_date: string;
}
