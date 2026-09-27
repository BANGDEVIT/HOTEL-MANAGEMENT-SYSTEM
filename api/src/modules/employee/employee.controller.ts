import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto, UpdateProfileDto } from './dto/update-employee.dto';
import { Roles } from '../../common/decorators/role-decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  EmployeeProfileResponseDto,
  EmployeeResponseDto,
  PaginatedEmployeeResponseDto,
} from './dto/employee-response';
import { QueryEmployeeDTO } from './dto/query-employee.dto';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import { UpdatePasswordDto } from './dto/reset-password.dto';
import { QueryProfileShiftDto } from './dto/profile-employee.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { NextShiftDto } from './dto/next-shift.dto';

@ApiTags('employees')
@ApiBearerAuth('JWT-auth')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @HttpCode(200)
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Lấy danh sách nhân viên',
    description: 'Hỗ trợ filter theo tên, vị trí và phân trang',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách nhân viên',
    type: PaginatedEmployeeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  findAll(
    @Query() query: QueryEmployeeDTO,
  ): Promise<PaginatedEmployeeResponseDto> {
    return this.employeeService.findAll(query);
  }

  @Get('profile')
  @HttpCode(200)
  @Roles('staff', 'admin', 'manager')
  @ApiOperation({
    summary: 'Xem thông tin trang cá nhân',
    description: 'Xem thông tin cá nhân',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về thông tin tràng cá nhân của nhân viên',
    type: EmployeeProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  async getProfile(
    @GetAccount('sub') accountId: string,
  ): Promise<EmployeeProfileResponseDto> {
    return this.employeeService.getProfile(accountId);
  }

  @Patch('profile')
  @HttpCode(200)
  @Roles('staff', 'admin', 'manager')
  @ApiOperation({
    summary: 'Cập nhật thông tin cá nhân',
    description: 'Cập nhật thông tin + ảnh đại diện cùng lúc',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string', example: 'Công', description: 'Tên' },
        last_name: { type: 'string', example: 'Bằng', description: 'Họ' },
        phone: {
          type: 'string',
          example: '0909123456',
          description: 'Số điện thoại',
        },
        gender: {
          type: 'string',
          enum: ['male', 'female', 'other'],
          example: 'male',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh đại diện (jpeg, png, webp, max 5MB)',
        },
      },
      required: [],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thành công',
    type: EmployeeProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpeg|png|webp)$/)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP'),
            false,
          );
        }
      },
    }),
  )
  async updateProfile(
    @GetAccount('sub') accountId: string,
    @Body() updateProfile: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<EmployeeProfileResponseDto> {
    return this.employeeService.updateProfile(accountId, updateProfile, file);
  }

  @Get('profile/shifts')
  @HttpCode(200)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Xem lịch làm việc của bản thân',
    description:
      'Nhân viên xem lịch làm việc của chính mình theo ngày hoặc tuần',
  })
  @ApiQuery({
    name: 'week',
    required: false,
    description: 'Xem cả tuần — truyền 1 ngày bất kỳ trong tuần (YYYY-MM-DD)',
    example: '2026-05-12',
  })
  @ApiQuery({
    name: 'work_date',
    required: false,
    description: 'Lọc theo ngày cụ thể (YYYY-MM-DD)',
    example: '2026-05-12',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về lịch làm việc',
  })
  @ApiResponse({
    status: 400,
    description: 'Không thể dùng work_date và week cùng lúc',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  async getProfileShifts(
    @GetAccount('sub') accountId: string,
    @Query() query: QueryProfileShiftDto,
  ) {
    return this.employeeService.getProfileShifts(accountId, query);
  }

  @Get('profile/next-shift')
  @HttpCode(200)
  @Roles('staff', 'admin', 'manager')
  @ApiOperation({
    summary: 'Ca gần nhất chưa kết thúc của tôi',
    description: 'Ca đang diễn ra hoặc sắp tới. Không có ca nào thì trả null',
  })
  @ApiResponse({ status: 200, type: NextShiftDto })
  getNextShift(
    @GetAccount('sub') accountId: string,
  ): Promise<NextShiftDto | null> {
    return this.employeeService.getNextShift(accountId);
  }

  @Patch('profile/password')
  @HttpCode(200)
  @Roles('staff', 'admin', 'manager')
  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description:
      'Nhân viên tự đổi mật khẩu — cần nhập email và mật khẩu hiện tại',
  })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({
    status: 400,
    description: 'Email hoặc mật khẩu hiện tại không đúng',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài khoản' })
  async updatePassword(
    @GetAccount('sub') accountId: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    await this.employeeService.updatePassword(accountId, updatePasswordDto);
    return { message: 'Đổi mật khẩu thành công' };
  }

  @Get(':id')
  @HttpCode(200)
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Lấy thông tin nhân viên theo ID',
    description: 'Chỉ manager mới xem được thông tin chi tiết của nhân viên',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của nhân viên',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về thông tin nhân viên',
    type: EmployeeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  findOne(@Param('id') id: string): Promise<EmployeeResponseDto> {
    return this.employeeService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Tạo nhân viên mới',
    description:
      'Tạo tài khoản + thông tin nhân viên. Chỉ manager mới có quyền',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo nhân viên thành công',
    type: EmployeeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Patch(':id')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Cập nhật thông tin nhân viên',
    description: 'Chi manager mới có quyền cập nhật.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của nhân viên',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Câp nhật thành công',
    type: UpdateEmployeeDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hơp lệ',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền câp nhật' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Patch(':id/reset-password')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Reset mật khẩu nhân viên',
    description: 'Reset về mật khẩu mặc định — nhân viên tự đổi sau khi login',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của nhân viên',
    example: 'uuid-123',
  })
  @ApiResponse({ status: 200, description: 'Reset mật khẩu thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  async resetPassword(@Param('id') id: string) {
    await this.employeeService.resetPassword(id);
    return { message: 'Reset mật khẩu thành công' };
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('manager', 'admin')
  // ...các @ApiResponse giữ nguyên
  @ApiResponse({
    status: 400,
    description: 'Không thể tự khoá tài khoản của mình',
  })
  async remove(
    @Param('id') id: string,
    @GetAccount('sub') accountId: string, // <- thêm
  ) {
    await this.employeeService.remove(id, accountId);
  }
}
