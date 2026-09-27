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
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import {
  PaginatedRoomResponseDto,
  RoomResponseDto,
} from './dto/room-response.dto';
import { QueryRoomDto } from './dto/query-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { QueryAvailableRoomDto } from './dto/query-available-room.dto';
import { UpdateRoomImagesDto } from './dto/update-room-images.dto';
import { RoomStatsDto } from './dto/room-stats.dto';
import { Roles } from '../../common/decorators/role-decorator';
import { Public } from '../../common/decorators/public.decorator';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** id trên URL phải là UUID -> sai thì trả 400, không để Prisma báo lỗi 500 */
const RoomId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

@Controller('rooms')
@ApiTags('rooms')
@ApiBearerAuth('JWT-auth')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  /* ===== Route tĩnh ('available', 'stats') PHẢI đứng trước ':id' ===== */

  @Get('available')
  @Public() // khách chưa đăng nhập vẫn xem được phòng trống
  @ApiOperation({ summary: 'Tìm phòng trống theo ngày' })
  @ApiResponse({ status: 200, description: 'Danh sách phòng trống' })
  @ApiResponse({ status: 400, description: 'Ngày không hợp lệ' })
  findAvailable(@Query() query: QueryAvailableRoomDto) {
    return this.roomService.findAvailable(query);
  }

  @Get('stats')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Đếm phòng theo trạng thái trên toàn khách sạn' })
  @ApiResponse({ status: 200, type: RoomStatsDto })
  getStats(): Promise<RoomStatsDto> {
    return this.roomService.getStats();
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Lấy danh sách phòng',
    description: 'Lọc theo trạng thái, loại phòng, tầng; tìm theo số phòng',
  })
  @ApiResponse({ status: 200, type: PaginatedRoomResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  findAll(@Query() query: QueryRoomDto): Promise<PaginatedRoomResponseDto> {
    return this.roomService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Xem chi tiết phòng' })
  @ApiParam({ name: 'id', description: 'UUID của phòng' })
  @ApiResponse({ status: 200, type: RoomResponseDto })
  @ApiResponse({ status: 400, description: 'id không phải UUID' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  findOne(@RoomId() id: string): Promise<RoomResponseDto> {
    return this.roomService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Tạo phòng mới',
    description: 'Chỉ manager và admin',
  })
  @ApiResponse({ status: 201, type: RoomResponseDto })
  @ApiResponse({ status: 400, description: 'Loại phòng đã ngừng sử dụng' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  @ApiResponse({ status: 409, description: 'Số phòng đã tồn tại' })
  create(@Body() dto: CreateRoomDto): Promise<RoomResponseDto> {
    return this.roomService.create(dto);
  }

  @Patch(':id/status')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Đổi trạng thái phòng',
    description:
      'available → cleaning, maintenance | cleaning → available | maintenance → available | occupied → cleaning',
  })
  @ApiParam({ name: 'id', description: 'UUID của phòng' })
  @ApiResponse({ status: 200, type: RoomResponseDto })
  @ApiResponse({ status: 400, description: 'Chuyển trạng thái không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  updateStatus(
    @RoomId() id: string,
    @Body() dto: UpdateRoomStatusDto,
  ): Promise<RoomResponseDto> {
    return this.roomService.updateStatus(id, dto);
  }

  @Patch(':id/images')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Sắp xếp hoặc xoá ảnh phòng',
    description:
      'Gửi danh sách ảnh cuối cùng. Ảnh không còn trong danh sách sẽ bị xoá khỏi S3.',
  })
  @ApiParam({ name: 'id', description: 'UUID của phòng' })
  @ApiResponse({ status: 200, type: RoomResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Danh sách chứa ảnh không thuộc phòng này',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  updateImages(
    @RoomId() id: string,
    @Body() dto: UpdateRoomImagesDto,
  ): Promise<RoomResponseDto> {
    return this.roomService.updateImages(id, dto);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Cập nhật phòng (loại phòng, tầng)' })
  @ApiParam({ name: 'id', description: 'UUID của phòng' })
  @ApiResponse({ status: 200, type: RoomResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Phòng đã ẩn hoặc loại phòng ngừng sử dụng',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phòng hoặc loại phòng',
  })
  update(
    @RoomId() id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    return this.roomService.update(id, dto);
  }

  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  @Roles('manager', 'admin')
  // CHỈ MỘT interceptor đọc file trên route này (2 cái -> "Unexpected end of form")
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) =>
        IMAGE_TYPES.includes(file.mimetype)
          ? cb(null, true)
          : // BadRequestException -> 400. new Error(...) sẽ thành 500
            cb(
              new BadRequestException(
                `${file.originalname} không phải ảnh jpeg, png hoặc webp`,
              ),
              false,
            ),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({
    summary: 'Thêm ảnh cho phòng',
    description: `Tối đa ${MAX_FILES} ảnh mỗi phòng, mỗi ảnh dưới 5MB, định dạng jpeg/png/webp`,
  })
  @ApiParam({ name: 'id', description: 'UUID của phòng' })
  @ApiResponse({ status: 201, type: RoomResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Sai định dạng, quá dung lượng hoặc vượt số ảnh',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  addImages(
    @RoomId() id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<RoomResponseDto> {
    return this.roomService.addImagesV2(id, files);
  }

  @Delete(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Ẩn phòng (xoá mềm)' })
  @ApiParam({ name: 'id', description: 'UUID của phòng' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Đã ẩn phòng' } } })
  @ApiResponse({
    status: 400,
    description: 'Phòng đã ẩn, đang có khách hoặc còn booking sắp tới',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  async remove(@RoomId() id: string) {
    await this.roomService.remove(id);
    return { message: 'Đã ẩn phòng' };
  }
}
