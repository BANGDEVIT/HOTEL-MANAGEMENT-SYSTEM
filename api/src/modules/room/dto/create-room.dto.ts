// create-room.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'A01', description: 'Số phòng' })
  @IsNotEmpty({ message: 'Số phòng không được để trống' })
  @IsString()
  room_number: string;

  @ApiProperty({ example: 'uuid-123', description: 'UUID loại phòng' })
  @IsNotEmpty({ message: 'Loại phòng không được để trống' })
  @IsUUID('4', { message: 'room_type_id không hợp lệ' })
  room_type_id: string;

  @ApiProperty({ example: 1, description: 'Tầng' })
  @IsNotEmpty({ message: 'Số tầng không được để trống' })
  @IsInt({ message: 'Số tầng phải là số nguyên' })
  @Min(1, { message: 'Số tầng phải lớn hơn 0' })
  floor: number;

  @ApiPropertyOptional({ example: ['url1', 'url2'] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
