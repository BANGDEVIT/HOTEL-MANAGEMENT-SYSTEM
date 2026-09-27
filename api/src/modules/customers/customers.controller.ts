import {
  BadRequestException,
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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import { CustomersService, type IdImageFiles } from './customers.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ChangePasswordDto } from './dto/chang-password-customer.dto';
import { LinkAccountDto } from './dto/link-account.dto';
import { LookupCustomerDto } from './dto/lookup-customer.dto';
import { QueryCustomerDto } from './dto/query-customers.dto';
import {
  CreateCustomerNoteDto,
  CustomerNoteDto,
} from './dto/customer-note.dto';
import {
  CustomerBookingDto,
  CustomerDetailDto,
  CustomerLookupDto,
  CustomerStatsDto,
  PaginatedCustomerResponseDto,
} from './dto/customer-response.dto';

/* ============================================================
 * Upload ảnh giấy tờ: trước đây cấu hình này bị chép 3 lần.
 * Gom thành 1 hàm -> sửa giới hạn dung lượng / định dạng chỉ 1 chỗ.
 * ============================================================ */
const IMAGE_MIME = /\/(jpeg|png|webp)$/;

function IdCardImages() {
  return UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front_image', maxCount: 1 },
        { name: 'back_image', maxCount: 1 },
      ],
      {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) =>
          IMAGE_MIME.test(file.mimetype)
            ? cb(null, true)
            : // BadRequestException -> 400. new Error(...) thì Nest trả 500.
              cb(
                new BadRequestException('Chỉ nhận ảnh JPEG, PNG hoặc WEBP'),
                false,
              ),
      },
    ),
  );
}

/** Schema multipart cho Swagger, dùng chung cho tạo và sửa */
const IDENTITY_FORM = {
  first_name: { type: 'string', example: 'Khoa' },
  last_name: { type: 'string', example: 'Trần Minh' },
  phone: { type: 'string', example: '0909123456' },
  email: { type: 'string' },
  id_type: { type: 'string', enum: ['cccd', 'passport'] },
  id_card: { type: 'string', example: '079203001234' },
  nationality: { type: 'string', example: 'Việt Nam' },
  allow_duplicate_phone: { type: 'boolean' },
  front_image: { type: 'string', format: 'binary' },
  back_image: { type: 'string', format: 'binary' },
};

/**
 * THỨ TỰ ROUTE QUAN TRỌNG: các route tĩnh (profile, stats, lookup, guest)
 * phải khai báo TRƯỚC ':id', nếu không "stats" sẽ bị hiểu là một id.
 */
@Controller('customers')
@ApiTags('customers')
@ApiBearerAuth('JWT-auth')
export class CustomersController {
  constructor(private readonly customerService: CustomersService) {}

  /* ==================== KHÁCH TỰ QUẢN LÝ HỒ SƠ ==================== */

  @Get('profile')
  @Roles('customer')
  @ApiOperation({ summary: 'Khách xem hồ sơ của mình' })
  @ApiResponse({ status: 200, type: CustomerDetailDto })
  getProfile(@GetAccount('sub') accountId: string): Promise<CustomerDetailDto> {
    return this.customerService.getProfile(accountId);
  }

  @Patch('profile')
  @Roles('customer')
  @IdCardImages()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      properties: (({ allow_duplicate_phone: _omit, ...rest }) => rest)(
        IDENTITY_FORM,
      ),
    },
  })
  @ApiOperation({
    summary: 'Khách tự sửa hồ sơ',
    description:
      'Không sửa được điểm thưởng. Ảnh gửi qua field front_image / back_image',
  })
  @ApiResponse({ status: 200, type: CustomerDetailDto })
  @ApiResponse({
    status: 409,
    description: 'Email hoặc số giấy tờ đã được dùng',
  })
  updateProfile(
    @GetAccount('sub') accountId: string,
    @Body() dto: UpdateCustomerProfileDto,
    @UploadedFiles() files: IdImageFiles,
  ): Promise<CustomerDetailDto> {
    return this.customerService.updateProfile(accountId, dto, files);
  }

  @Patch('profile/password')
  @Roles('customer')
  @ApiOperation({ summary: 'Khách đổi mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({
    status: 400,
    description: 'Sai mật khẩu hiện tại hoặc trùng mật khẩu cũ',
  })
  async changePassword(
    @GetAccount('sub') accountId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.customerService.changePassword(accountId, dto);
    return { message: 'Đổi mật khẩu thành công' };
  }

  /* ==================== NHÂN VIÊN: ROUTE TĨNH ==================== */

  @Get('stats')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Thống kê khách cho 4 ô số liệu và số trên tab lọc',
  })
  @ApiResponse({ status: 200, type: CustomerStatsDto })
  getStats(): Promise<CustomerStatsDto> {
    return this.customerService.getStats();
  }

  @Get('lookup')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Kiểm tra trùng theo SĐT hoặc số giấy tờ',
    description:
      'Dùng khi đang nhập form thêm/sửa khách. Trả tối đa 5 hồ sơ khớp',
  })
  @ApiResponse({ status: 200, type: [CustomerLookupDto] })
  lookup(@Query() query: LookupCustomerDto): Promise<CustomerLookupDto[]> {
    return this.customerService.lookup(query);
  }

  @Post('guest')
  @HttpCode(HttpStatus.CREATED)
  @Roles('staff', 'manager', 'admin')
  @IdCardImages()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['first_name', 'last_name', 'phone'],
      properties: IDENTITY_FORM,
    },
  })
  @ApiOperation({ summary: 'Tạo khách vãng lai tại quầy' })
  @ApiResponse({ status: 201, type: CustomerDetailDto })
  @ApiResponse({
    status: 409,
    description: 'Trùng số giấy tờ, hoặc trùng SĐT mà chưa xác nhận',
  })
  createGuest(
    @Body() dto: CreateGuestDto,
    @UploadedFiles() files: IdImageFiles,
  ): Promise<CustomerDetailDto> {
    return this.customerService.createGuest(dto, files);
  }

  @Get()
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Danh sách khách',
    description:
      'Tìm theo tên/SĐT/email/số giấy tờ, lọc thành viên, quốc tịch, tình trạng lưu trú',
  })
  @ApiResponse({ status: 200, type: PaginatedCustomerResponseDto })
  findAll(
    @Query() query: QueryCustomerDto,
  ): Promise<PaginatedCustomerResponseDto> {
    return this.customerService.findAll(query);
  }

  /* ==================== NHÂN VIÊN: THEO :id ==================== */

  @Get(':id')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Chi tiết khách (có số giấy tờ đầy đủ)' })
  @ApiParam({ name: 'id', description: 'UUID khách hàng' })
  @ApiResponse({ status: 200, type: CustomerDetailDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khách hàng' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerDetailDto> {
    return this.customerService.findById(id);
  }

  @Get(':id/bookings')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Lịch sử đặt phòng của khách (50 lần gần nhất)' })
  @ApiResponse({ status: 200, type: [CustomerBookingDto] })
  getBookings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerBookingDto[]> {
    return this.customerService.getBookings(id);
  }

  @Get(':id/notes')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Ghi chú nội bộ về khách, mới nhất trước' })
  @ApiResponse({ status: 200, type: [CustomerNoteDto] })
  listNotes(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerNoteDto[]> {
    return this.customerService.listNotes(id);
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Thêm ghi chú nội bộ' })
  @ApiResponse({ status: 201, type: CustomerNoteDto })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @GetAccount('sub') accountId: string,
    @Body() dto: CreateCustomerNoteDto,
  ): Promise<CustomerNoteDto> {
    return this.customerService.addNote(id, accountId, dto);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Xoá ghi chú (người viết hoặc quản lý)' })
  @ApiResponse({ status: 204, description: 'Đã xoá' })
  @ApiResponse({
    status: 403,
    description: 'Không phải người viết, cũng không phải quản lý',
  })
  async deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @GetAccount('sub') accountId: string,
    @GetAccount('roles') roles: string[],
  ): Promise<void> {
    await this.customerService.deleteNote(id, noteId, accountId, roles);
  }

  @Post(':id/link-account')
  @HttpCode(HttpStatus.OK)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Tạo tài khoản cho khách vãng lai',
    description:
      'Khách đã ở tại quầy muốn đăng ký thành viên, giữ nguyên lịch sử cũ',
  })
  @ApiResponse({ status: 200, description: 'Liên kết thành công' })
  @ApiResponse({ status: 400, description: 'Khách đã có tài khoản' })
  @ApiResponse({ status: 409, description: 'Email đã được dùng' })
  linkAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkAccountDto,
  ): Promise<{ message: string }> {
    return this.customerService.linkAccount(id, dto);
  }

  @Patch(':id')
  @Roles('staff', 'manager', 'admin')
  @IdCardImages()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ...IDENTITY_FORM,
        reward_points: { type: 'integer', description: 'Chỉ quản lý' },
        is_active: {
          type: 'boolean',
          description: 'Chỉ quản lý, chỉ khách có tài khoản',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Nhân viên sửa hồ sơ khách',
    description:
      'Staff sửa thông tin và ảnh giấy tờ. Điểm thưởng và khoá tài khoản chỉ quản lý làm được',
  })
  @ApiResponse({ status: 200, type: CustomerDetailDto })
  @ApiResponse({
    status: 403,
    description: 'Staff sửa điểm thưởng hoặc khoá tài khoản',
  })
  @ApiResponse({ status: 409, description: 'Trùng số giấy tờ hoặc SĐT' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @UploadedFiles() files: IdImageFiles,
    @GetAccount('roles') roles: string[],
  ): Promise<CustomerDetailDto> {
    return this.customerService.update(id, dto, files, roles);
  }

  // KHÔNG còn DELETE /customers/:id:
  // khách có lịch sử đặt phòng và hoá đơn nên không xoá. Khoá tài khoản dùng PATCH :id { is_active: false }.
}
