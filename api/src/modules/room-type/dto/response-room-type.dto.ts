import { ApiProperty } from '@nestjs/swagger';
import { Amenity } from './create-room-type.dto';
import { BedType } from '@prisma/client';

export class RoomTypeResponseDto {
  @ApiProperty({ example: 'uuid123' })
  id: string;

  @ApiProperty({ example: 'VIP' })
  name: string;

  @ApiProperty({ example: 500000 })
  base_price: number;

  @ApiProperty({ example: 2 })
  capacity: number;

  @ApiProperty({
    example: ['wifi', 'tv', 'air_conditioning'],
    enum: Amenity,
    isArray: true,
  })
  amenities: Amenity[];

  @ApiProperty({ example: 'double', enum: BedType })
  bed_type: BedType;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  updated_at: Date;
}

export class PaginationRoomTypeResponseDto {
  @ApiProperty({ type: [RoomTypeResponseDto] })
  data: RoomTypeResponseDto[];

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPage: number;
}
