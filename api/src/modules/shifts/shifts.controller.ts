import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { QueryShiftDTO } from './dto/query-shift.dto';
import {
  PaginatedShiftResponseDto,
  ResponseShiftDto,
  ShiftDetailResponseDto,
} from './dto/response-shift.dto';
import {
  AssignEmployeeDto,
  AssignEmployeeResponseDto,
} from './dto/assign-employees.dto';
import { RemoveEmployeeQueryDto } from './dto/remove-employee-shift.dto';
import { QueryScheduleDto, ScheduleItemDto } from './dto/schedule.dto';

/**
 * Thứ tự route QUAN TRỌNG: 'schedule' phải khai báo trước ':id',
 * nếu không GET /shifts/schedule sẽ bị hiểu là GET /shifts/:id với id = "schedule".
 *
 * ParseUUIDPipe: id sai định dạng -> 400 ngay ở controller.
 * Không có pipe này thì Prisma ném lỗi khi query cột @db.Uuid -> ra 500.
 *
 * Query param (search, work_date, week...) đã mô tả trong DTO bằng @ApiPropertyOptional,
 * nên KHÔNG khai báo thêm @ApiQuery — khai báo cả 2 thì Swagger hiện trùng.
 */
@ApiTags('shifts')
@ApiBearerAuth('JWT-auth')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('schedule')
  @HttpCode(200)
  @Roles('manager', 'admin', 'staff')
  @ApiOperation({
    summary: 'Xem lịch làm việc tổng hợp',
    description:
      'Lọc theo tên nhân viên, 1 ngày cụ thể hoặc cả tuần. Không truyền gì = tuần hiện tại',
  })
  @ApiResponse({ status: 200, type: [ScheduleItemDto] })
  @ApiResponse({ status: 400, description: 'Dùng work_date và week cùng lúc' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  getSchedule(@Query() query: QueryScheduleDto): Promise<ScheduleItemDto[]> {
    return this.shiftsService.getSchedule(query);
  }

  @Get()
  @HttpCode(200)
  @Roles('manager', 'admin', 'staff')
  @ApiOperation({
    summary: 'Danh sách ca làm',
    description: 'Sắp theo giờ bắt đầu. Có thể lọc theo tên ca',
  })
  @ApiResponse({ status: 200, type: PaginatedShiftResponseDto })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  findAll(@Query() query: QueryShiftDTO): Promise<PaginatedShiftResponseDto> {
    return this.shiftsService.findAll(query);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Tạo ca làm',
    description:
      'Mỗi loại ca (morning / afternoon / evening / night) chỉ có 1 bản ghi',
  })
  @ApiResponse({ status: 201, type: ResponseShiftDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 409, description: 'Ca đã tồn tại' })
  create(@Body() dto: CreateShiftDto): Promise<ResponseShiftDto> {
    return this.shiftsService.create(dto);
  }

  @Get(':id')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Chi tiết ca làm',
    description: 'Kèm danh sách nhân viên được phân công từ hôm nay trở đi',
  })
  @ApiParam({ name: 'id', description: 'UUID của ca làm' })
  @ApiResponse({ status: 200, type: ShiftDetailResponseDto })
  @ApiResponse({ status: 400, description: 'id không phải UUID' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy ca làm' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShiftDetailResponseDto> {
    return this.shiftsService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Cập nhật ca làm (tên hoặc giờ)' })
  @ApiParam({ name: 'id', description: 'UUID của ca làm' })
  @ApiResponse({ status: 200, type: ResponseShiftDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy ca làm' })
  @ApiResponse({ status: 409, description: 'Trùng tên ca' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ): Promise<ResponseShiftDto> {
    return this.shiftsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Xoá ca làm',
    description: 'Chỉ xoá được khi không còn lượt phân công từ hôm nay trở đi',
  })
  @ApiParam({ name: 'id', description: 'UUID của ca làm' })
  @ApiResponse({ status: 204, description: 'Xoá thành công' })
  @ApiResponse({ status: 400, description: 'Còn lịch phân công sắp tới' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy ca làm' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.shiftsService.remove(id);
  }

  @Post(':id/employees')
  @HttpCode(201)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Xếp nhân viên vào ca',
    description:
      'Xếp nhiều người cùng lúc vào 1 ca, 1 ngày. Người đã có sẵn trong ca được bỏ qua. ' +
      'Người đã có ca khác cùng ngày -> 409',
  })
  @ApiParam({ name: 'id', description: 'UUID của ca làm' })
  @ApiResponse({ status: 201, type: AssignEmployeeResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Ngày đã qua, hoặc tài khoản nhân viên đã bị khoá',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy ca hoặc nhân viên' })
  @ApiResponse({
    status: 409,
    description: 'Nhân viên đã có ca khác trong ngày',
  })
  assignEmployees(
    @Param('id', ParseUUIDPipe) shiftId: string,
    @Body() dto: AssignEmployeeDto,
  ): Promise<AssignEmployeeResponseDto> {
    return this.shiftsService.assignEmployees(shiftId, dto);
  }

  // DELETE /shifts/:id/employees/:employeeId?work_date=2026-09-28
  @Delete(':id/employees/:employeeId')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Gỡ nhân viên khỏi ca trong 1 ngày' })
  @ApiParam({ name: 'id', description: 'UUID của ca làm' })
  @ApiParam({ name: 'employeeId', description: 'UUID của nhân viên' })
  @ApiResponse({ status: 200, description: 'Gỡ thành công' })
  @ApiResponse({ status: 400, description: 'Ngày đã qua' })
  @ApiResponse({
    status: 404,
    description: 'Nhân viên không có trong ca ngày đó',
  })
  async removeEmployee(
    @Param('id', ParseUUIDPipe) shiftId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: RemoveEmployeeQueryDto,
  ): Promise<{ message: string }> {
    await this.shiftsService.removeEmployee(
      shiftId,
      employeeId,
      query.work_date,
    );
    return { message: 'Đã gỡ nhân viên khỏi ca' };
  }
}
