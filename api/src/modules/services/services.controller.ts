import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import {
  UpdateServiceDto,
  UpdateServiceStatusDto,
} from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import {
  PaginatedServiceResponseDto,
  ServiceResponseDto,
  ServiceStatsDto,
} from './dto/service-response.dto';

/** Chỉ nhận UUID v4, sai định dạng -> 400 trước khi chạm DB */
const ServiceId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

/**
 * Lễ tân: chỉ xem (cần danh sách để thêm dịch vụ cho khách đang ở).
 * Quản lý / admin: thêm, sửa, bật tắt, xoá.
 *
 * THỨ TỰ ROUTE: /stats phải đứng TRƯỚC /:id, nếu không Nest hiểu "stats" là một id.
 */
@ApiTags('Services')
@ApiBearerAuth('JWT-auth')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Danh sách dịch vụ kèm lượt dùng 30 ngày',
    description:
      'Lọc theo nhóm, trạng thái, tìm theo tên. Màn đặt phòng gọi với status=active',
  })
  @ApiResponse({ status: 200, type: PaginatedServiceResponseDto })
  findAll(
    @Query() query: QueryServiceDto,
  ): Promise<PaginatedServiceResponseDto> {
    return this.servicesService.findAll(query);
  }

  @Get('stats')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary:
      'Số liệu: số dịch vụ theo nhóm, doanh thu tháng, top dùng nhiều, chưa ai dùng',
  })
  @ApiResponse({ status: 200, type: ServiceStatsDto })
  getStats(): Promise<ServiceStatsDto> {
    return this.servicesService.getStats();
  }

  @Get(':id')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Chi tiết 1 dịch vụ' })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dịch vụ' })
  findOne(@ServiceId() id: string): Promise<ServiceResponseDto> {
    return this.servicesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Thêm dịch vụ' })
  @ApiResponse({ status: 201, type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 409,
    description: 'Trùng tên (không phân biệt hoa thường)',
  })
  create(@Body() dto: CreateServiceDto): Promise<ServiceResponseDto> {
    return this.servicesService.create(dto);
  }

  @Patch(':id/status')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Bật / tắt đang bán',
    description: 'Ngừng bán: lễ tân không chọn được nữa, hoá đơn cũ giữ nguyên',
  })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dịch vụ' })
  setStatus(
    @ServiceId() id: string,
    @Body() dto: UpdateServiceStatusDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.setActive(id, dto.is_active);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Sửa dịch vụ',
    description:
      'Đổi giá chỉ áp dụng cho lần dùng sau, hoá đơn cũ giữ giá lúc dùng',
  })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dịch vụ' })
  @ApiResponse({ status: 409, description: 'Trùng tên' })
  update(
    @ServiceId() id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Xoá hẳn dịch vụ',
    description:
      'Chỉ khi CHƯA TỪNG được dùng. Đã dùng thì dùng PATCH /:id/status để ngừng bán',
  })
  @ApiResponse({ status: 204, description: 'Đã xoá' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dịch vụ' })
  @ApiResponse({
    status: 409,
    description: 'Đã có trong hoá đơn, chỉ ngừng bán được',
  })
  async remove(@ServiceId() id: string): Promise<void> {
    await this.servicesService.remove(id);
  }
}
