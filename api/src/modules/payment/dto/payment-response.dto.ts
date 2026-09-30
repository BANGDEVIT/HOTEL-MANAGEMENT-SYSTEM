import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

/** 1 phiếu thu kèm tình trạng hoá đơn hiện tại */
export class PaymentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() invoice_id: string;
  @ApiProperty({ example: 'HD-260929-0012' }) invoice_code: string;
  @ApiProperty({ example: 500000 }) amount: number;
  @ApiProperty({ enum: PaymentMethod }) payment_method: PaymentMethod;
  @ApiProperty({ nullable: true, example: 'FT26093012345' }) reference_number:
    | string
    | null;
  @ApiProperty({ nullable: true }) note: string | null;
  @ApiProperty() paid_at: Date;
  @ApiProperty() created_at: Date;
  @ApiProperty({
    nullable: true,
    description: 'Tên nhân viên thu. Khách xem thì null',
  })
  received_by: string | null;

  @ApiProperty({ nullable: true, description: 'null = phiếu còn hiệu lực' })
  voided_at: Date | null;
  @ApiProperty({
    nullable: true,
    description: 'Tên quản lý huỷ. Khách xem thì null',
  })
  voided_by: string | null;
  @ApiProperty({ nullable: true }) void_reason: string | null;

  @ApiProperty({ enum: InvoiceStatus }) invoice_status: InvoiceStatus;
  @ApiProperty({ example: 900000 }) invoice_final_amount: number;
  @ApiProperty({ example: 500000, description: 'Tổng các phiếu còn hiệu lực' })
  total_paid: number;
  @ApiProperty({ example: 400000 }) remaining: number;
}
