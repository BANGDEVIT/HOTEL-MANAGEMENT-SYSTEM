// dto/booking-service-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingServiceResponseDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Dịch vụ spa' })
  service_name: string;

  @ApiPropertyOptional({ example: 'spa' })
  category?: string | null;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 200000 })
  unit_price: number;

  @ApiProperty({ example: 400000 })
  total_price: number;

  @ApiPropertyOptional({ example: 'Ghi chú' })
  note: string | null;

  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  used_at: Date;
}

export class AddMultipleServiceResponseDto {
  @ApiProperty({ type: [BookingServiceResponseDto] })
  booking_services: BookingServiceResponseDto[];

  @ApiProperty({ description: 'tổng dịch vụ được thêm vào' })
  total_added: number;

  @ApiProperty({ description: 'Cập nhật hóa đơn' })
  invoice_updated: boolean;

  @ApiProperty({ description: 'tổng hóa đơn mới chưa giảm giá' })
  new_total_amount: number;

  @ApiProperty({ description: 'Tổng hóa đơn mới sau giảm giá' })
  new_final_amount: number;
}
