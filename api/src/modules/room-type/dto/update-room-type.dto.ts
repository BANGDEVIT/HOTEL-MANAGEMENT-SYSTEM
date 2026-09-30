import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { CreateRoomTypeDto } from './create-room-type.dto';

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {}

/** PATCH /room-types/:id/status: bật / tắt kinh doanh */
export class UpdateRoomTypeStatusDto {
  @ApiProperty({
    example: false,
    description: 'false = ngừng kinh doanh, không nhận booking mới',
  })
  @IsBoolean({ message: 'is_active phải là true hoặc false' })
  is_active: boolean;
}
