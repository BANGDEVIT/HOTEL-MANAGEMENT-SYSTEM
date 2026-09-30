import { ApiProperty } from '@nestjs/swagger';
import { BedType } from '@prisma/client';
import { Amenity } from './create-room-type.dto';

export class RoomTypeResponseDto {
  @ApiProperty({ example: 'uuid123' }) id: string;
  @ApiProperty({ example: 'Deluxe' }) name: string;
  @ApiProperty({ example: 800000 }) base_price: number;
  @ApiProperty({ example: 2 }) capacity: number;
  @ApiProperty({
    example: ['wifi', 'tv', 'air_conditioning'],
    enum: Amenity,
    isArray: true,
  })
  amenities: Amenity[];
  @ApiProperty({ example: 'twin', enum: BedType }) bed_type: BedType;
  @ApiProperty({ example: 28, nullable: true, description: 'm²' }) area:
    | number
    | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ example: true }) is_active: boolean;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class PaginationRoomTypeResponseDto {
  @ApiProperty({ type: [RoomTypeResponseDto] }) data: RoomTypeResponseDto[];
  @ApiProperty({ example: 10 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 10 }) limit: number;
  @ApiProperty({ example: 1 }) totalPage: number; // giữ tên cũ: trang Phòng / trang khách đang dùng
}

/* ============================ Màn quản lý ============================ */

export class RoomCountByStatusDto {
  @ApiProperty() total: number;
  @ApiProperty() available: number;
  @ApiProperty() occupied: number;
  @ApiProperty() cleaning: number;
  @ApiProperty() maintenance: number;
  @ApiProperty() inactive: number;
}

/** 1 loại phòng ở màn Loại phòng: thông tin + số liệu vận hành */
export class RoomTypeAdminItemDto extends RoomTypeResponseDto {
  @ApiProperty({ type: RoomCountByStatusDto }) rooms: RoomCountByStatusDto;

  @ApiProperty({
    example: 72,
    description: '% đêm phòng đã bán / đêm phòng có thể bán trong 30 ngày qua',
  })
  occupancy_30d: number;

  @ApiProperty({
    example: 18400000,
    description: 'Tiền phòng (không gồm dịch vụ) của các đêm trong 30 ngày qua',
  })
  revenue_30d: number;

  @ApiProperty({
    example: 3,
    description: 'Booking chờ duyệt / đã xác nhận / đang ở chưa kết thúc',
  })
  upcoming_bookings: number;

  @ApiProperty({
    example: 2,
    description:
      'Số khách lớn nhất trong các booking chưa kết thúc (không cho giảm sức chứa dưới số này)',
  })
  max_upcoming_guests: number;

  @ApiProperty({ description: 'Chưa có phòng nào -> xoá hẳn được' })
  can_delete: boolean;
}
