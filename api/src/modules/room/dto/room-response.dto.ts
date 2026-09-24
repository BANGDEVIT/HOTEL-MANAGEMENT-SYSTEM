// response-room.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import { Amenity } from '../../room-type/dto/create-room-type.dto';

export class RoomTypeInRoomDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Deluxe' })
  name: string;

  @ApiProperty({ example: 500000 })
  base_price: number;

  @ApiProperty({ example: 2 })
  capacity: number;

  @ApiProperty({ example: 'double' })
  bed_type: string;

  @ApiPropertyOptional({
    example: ['wifi', 'tv'],
    enum: Amenity,
    isArray: true,
  })
  amenities: Amenity[];
}

export class RoomResponseDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'A01' })
  room_number: string;

  @ApiProperty({ example: 1 })
  floor: number;

  @ApiProperty({ example: 'available', enum: RoomStatus })
  status: RoomStatus;

  @ApiProperty({ type: RoomTypeInRoomDto })
  room_type: RoomTypeInRoomDto;

  @ApiPropertyOptional({ example: ['url1', 'url2'] })
  images: string[];

  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  updated_at: Date;
}

export class PaginatedRoomResponseDto {
  @ApiProperty({ type: [RoomResponseDto] })
  data: RoomResponseDto[];

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
