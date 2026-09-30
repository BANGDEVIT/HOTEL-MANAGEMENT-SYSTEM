import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Các tab ở màn Hoá đơn, mỗi tab = 1 câu hỏi của thu ngân / quản lý:
 *   open  Khách đang ở: hoá đơn còn cộng dồn dịch vụ, có thể tạm ứng
 *   debt  Đã trả phòng mà còn thiếu tiền (công nợ, thường do huỷ phiếu thu)
 *   paid  Đã trả phòng, đã thu đủ
 *   all   Tất cả
 */
export const INVOICE_TABS = ['all', 'open', 'debt', 'paid'] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];

export const INVOICE_SORTS = ['created_at', 'final_amount'] as const;
export type InvoiceSort = (typeof INVOICE_SORTS)[number];

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class QueryInvoiceDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: INVOICE_TABS, default: 'all' })
  @IsOptional()
  @IsIn([...INVOICE_TABS])
  tab?: InvoiceTab = 'all';

  @ApiPropertyOptional({
    example: 'HD-2609 Khoa',
    description:
      'Mỗi từ phải khớp số hoá đơn / mã booking, tên hoặc SĐT khách, số phòng',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Có ít nhất 1 phiếu thu còn hiệu lực bằng phương thức này',
  })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Phương thức thanh toán không hợp lệ' })
  method?: PaymentMethod;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Ngày lập (= ngày nhận phòng) từ ngày, giờ VN',
  })
  @IsOptional()
  @Matches(YMD, { message: 'from phải có dạng YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Ngày lập tới ngày (tính cả ngày này)',
  })
  @IsOptional()
  @Matches(YMD, { message: 'to phải có dạng YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ enum: INVOICE_SORTS, default: 'created_at' })
  @IsOptional()
  @IsIn([...INVOICE_SORTS])
  sort?: InvoiceSort = 'created_at';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

/** GET /invoices/stats: bỏ trống = tháng này */
export class InvoiceStatsQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(YMD, { message: 'from phải có dạng YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Matches(YMD, { message: 'to phải có dạng YYYY-MM-DD' })
  to?: string;
}
