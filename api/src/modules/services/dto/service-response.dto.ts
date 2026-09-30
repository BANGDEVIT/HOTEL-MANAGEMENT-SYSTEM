import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory, ServiceUnit } from '@prisma/client';

export class ServiceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Giặt ủi' }) name: string;
  @ApiProperty({ enum: ServiceCategory }) category: ServiceCategory;
  @ApiProperty({ enum: ServiceUnit }) unit: ServiceUnit;
  @ApiProperty({ example: 50000 }) price: number;
  @ApiProperty() is_active: boolean;

  // ----- tính từ booking_services -----
  @ApiProperty({
    example: 41,
    description: 'Tổng SỐ LƯỢNG đã dùng trong 30 ngày (41 kg, 86 suất...)',
  })
  usage_30d: number;

  @ApiProperty({
    example: 2050000,
    description: 'Doanh thu 30 ngày, tính theo giá lúc dùng',
  })
  revenue_30d: number;

  @ApiProperty({
    example: 312,
    description: 'Số lần xuất hiện trong hoá đơn từ trước tới nay',
  })
  total_uses: number;

  @ApiProperty({
    description: 'Chỉ xoá hẳn được khi chưa từng dùng (total_uses = 0)',
  })
  can_delete: boolean;

  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class PaginatedServiceResponseDto {
  @ApiProperty({ type: [ServiceResponseDto] }) data: ServiceResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class ServiceUsageItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ServiceUnit }) unit: ServiceUnit;
  @ApiProperty() usage_30d: number;
  @ApiProperty() revenue_30d: number;
}

export class ServiceStatsDto {
  @ApiProperty({ example: 15 }) total: number;
  @ApiProperty({ example: 12 }) active: number;

  @ApiProperty({
    example: { food: 2, laundry: 2, minibar: 3, surcharge: 2, other: 3 },
    description:
      'Số dịch vụ mỗi nhóm (cả đang bán lẫn ngừng bán) -> số trên tab',
  })
  by_category: Record<ServiceCategory, number>;

  @ApiProperty({
    example: 18400000,
    description: 'Doanh thu dịch vụ từ đầu tháng tới giờ (giờ VN)',
  })
  revenue_this_month: number;

  @ApiProperty({ example: 16400000 }) revenue_last_month: number;

  @ApiProperty({
    example: 214,
    description: 'Số lần gọi dịch vụ (số dòng) trong 30 ngày',
  })
  uses_30d: number;

  @ApiProperty({
    type: [ServiceUsageItemDto],
    description: 'Top 3 dùng nhiều nhất 30 ngày',
  })
  top: ServiceUsageItemDto[];

  @ApiProperty({
    type: [ServiceUsageItemDto],
    description: 'Đang bán nhưng 30 ngày chưa ai dùng',
  })
  unused: ServiceUsageItemDto[];
}
