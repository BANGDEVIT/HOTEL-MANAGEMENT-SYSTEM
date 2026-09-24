import { ApiProperty } from '@nestjs/swagger';

export class RoomStatsDto {
  @ApiProperty({ example: 2 }) available: number;
  @ApiProperty({ example: 4 }) occupied: number;
  @ApiProperty({ example: 0 }) cleaning: number;
  @ApiProperty({ example: 1 }) maintenance: number;
  @ApiProperty({ example: 0 }) inactive: number;

  @ApiProperty({
    example: 7,
    description: 'Tổng phòng đang kinh doanh, không tính phòng đã ẩn',
  })
  total: number;
}
