import { ApiProperty } from '@nestjs/swagger';
import { ShiftName } from '@prisma/client';
import { IsEnum, Matches } from 'class-validator';

/** HH:mm, 24 giờ: 00:00 -> 23:59 */
export const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftDto {
  @ApiProperty({ enum: ShiftName, example: ShiftName.morning })
  @IsEnum(ShiftName, {
    message: 'Tên ca phải là morning, afternoon, evening hoặc night',
  })
  name: ShiftName;

  @ApiProperty({ example: '06:00', description: 'Giờ bắt đầu, dạng HH:mm' })
  @Matches(HHMM_REGEX, { message: 'Giờ bắt đầu phải có dạng HH:mm' })
  start_time: string;

  @ApiProperty({
    example: '14:00',
    description: 'Giờ kết thúc, dạng HH:mm. Nhỏ hơn giờ bắt đầu = ca qua đêm',
  })
  @Matches(HHMM_REGEX, { message: 'Giờ kết thúc phải có dạng HH:mm' })
  end_time: string;
}
