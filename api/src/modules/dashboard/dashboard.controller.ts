import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewDto } from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Số liệu trang Tổng quan',
    description:
      'Khách đến / đi hôm nay, tình trạng phòng, thực thu, ADR, RevPAR, công suất 7 ngày, việc cần xử lý. ' +
      'Gom trong 1 request để trang đầu tiên mở nhanh',
  })
  @ApiResponse({ status: 200, type: DashboardOverviewDto })
  overview(): Promise<DashboardOverviewDto> {
    return this.dashboardService.overview();
  }
}
