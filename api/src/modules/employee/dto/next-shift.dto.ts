import { ApiProperty } from '@nestjs/swagger';
import { ResponseShiftDto } from '../../shifts/dto/response-shift.dto';

export class NextShiftDto {
  @ApiProperty({ description: 'id của EmployeeShift' })
  id: string;

  @ApiProperty({ example: '2026-09-24' })
  work_date: string;

  @ApiProperty({
    example: '2026-09-24T07:00:00.000Z',
    description: 'Thời điểm bắt đầu, dạng ISO',
  })
  starts_at: string;

  @ApiProperty({
    example: '2026-09-24T15:00:00.000Z',
    description: 'Ca đêm thì là sáng hôm sau',
  })
  ends_at: string;

  @ApiProperty({ enum: ['ongoing', 'upcoming'] })
  status: 'ongoing' | 'upcoming';

  @ApiProperty({ type: ResponseShiftDto })
  shift: ResponseShiftDto;
}
