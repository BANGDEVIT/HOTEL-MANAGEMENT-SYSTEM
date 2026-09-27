import { ApiProperty } from '@nestjs/swagger';

export class FloorStatsDto {
  @ApiProperty({ example: 2 }) floor: number;
  @ApiProperty({ example: 5, description: 'Không tính phòng đã ẩn' })
  total: number;
  @ApiProperty({ example: 2 }) available: number;
  @ApiProperty({ example: 2 }) occupied: number;
  @ApiProperty({ example: 0 }) cleaning: number;
  @ApiProperty({ example: 1 }) maintenance: number;
}

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

  @ApiProperty({ type: [FloorStatsDto], description: 'Sắp theo tầng tăng dần' })
  floors: FloorStatsDto[];
}
