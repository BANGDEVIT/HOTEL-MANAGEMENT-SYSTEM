// dto/add-booking-service.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddBookingServiceDto {
  @ApiProperty({
    example: 'uuid-123',
    description: 'UUID của dịch vụ',
  })
  @IsNotEmpty({ message: 'service_id không được để trống' })
  @IsUUID('4', { message: 'service_id không hợp lệ' })
  service_id: string;

  @ApiProperty({ example: 2, description: 'Số lượng' })
  @IsNotEmpty()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity: number;

  @ApiPropertyOptional({ example: 'Ghi chú đặc biệt' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ServiceItemDto {
  @ApiProperty({
    example: 'uuid-123',
    description: 'UUID của dịch vụ ',
  })
  @IsNotEmpty({ message: 'service_id không được để trống' })
  @IsUUID('4', { message: 'service_id không hợp lệ' })
  service_Id: string;

  @ApiProperty({
    example: '10',
    description: 'số lượng',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Ghi chú đặc biệt' })
  @IsOptional()
  @IsString()
  note: string;
}

export class AddBookingServicesDto {
  @ApiProperty({
    type: [ServiceItemDto],
    example: [
      { service_id: 'uuid-1', quantity: 2, note: 'Ghi chú' },
      { service_id: 'uuid-2', quantity: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  services: ServiceItemDto[];
}
