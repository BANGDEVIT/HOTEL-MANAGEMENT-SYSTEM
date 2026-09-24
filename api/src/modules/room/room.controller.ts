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
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import {
  PaginatedRoomResponseDto,
  RoomResponseDto,
} from './dto/room-response.dto';
import { Roles } from '../../common/decorators/role-decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QueryRoomDto } from './dto/query-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../../common/decorators/public.decorator';
import { QueryAvailableRoomDto } from './dto/query-available-room.dto';
import { UpdateRoomImagesDto } from './dto/update-room-images.dto';
import { RoomStatsDto } from './dto/room-stats.dto';

@Controller('rooms')
@ApiTags('rooms')
@ApiBearerAuth('JWT-auth')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('available')
  @HttpCode(200)
  @Public() // ← Không cần đăng nhập — khách browse phòng
  @ApiOperation({
    summary: 'Tìm phòng trống theo ngày',
    description:
      'Public API — Khách hàng tìm phòng available trong khoảng thời gian',
  })
  @ApiResponse({ status: 200, description: 'Danh sách phòng trống' })
  @ApiResponse({ status: 400, description: 'Ngày không hợp lệ' })
  async findAvailable(@Query() query: QueryAvailableRoomDto) {
    return this.roomService.findAvailable(query);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager', 'admin')
  // ← Sau khi setup AWS S3 thì thêm vào
  // @UseInterceptors(FileInterceptor('file'))
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       room_number: { type: 'string', example: 'A01' },
  //       room_type_id: { type: 'string', example: 'uuid-123' },
  //       floor: { type: 'number', example: 1 },
  //       file: { type: 'string', format: 'binary' },
  //     },
  //   },
  // })
  @ApiOperation({
    summary: 'Tạo phòng mới',
    description: 'Chỉ manager và admin mới có quyền tạo phòng',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo phòng thành công',
    type: RoomResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Loại phòng đã bị xóa' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  @ApiResponse({ status: 409, description: 'Số phòng đã tồn tại' })
  async create(
    @Body() createRoomDto: CreateRoomDto,
    // @UploadedFile() file?: Express.Multer.File, ← thêm sau khi setup AWS S3
  ): Promise<RoomResponseDto> {
    return this.roomService.create(createRoomDto);
  }

  @Get()
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Lấy danh sách phòng',
    description: 'Hỗ trợ filter theo trạng thái, loại phòng, tầng',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách phòng',
    type: PaginatedRoomResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  async findAll(@Query() query: QueryRoomDto) {
    return this.roomService.findAll(query);
  }

  @Get('stats')
  @HttpCode(200)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({ summary: 'Đếm phòng theo trạng thái trên toàn khách sạn' })
  @ApiResponse({ status: 200, type: RoomStatsDto })
  getStats(): Promise<RoomStatsDto> {
    return this.roomService.getStats();
  }

  @Get(':id')
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Xem chi tiết phòng',
    description: 'Xem thông tin chi tiết của 1 phòng',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về chi tiết phòng',
    type: RoomResponseDto,
  })
  @ApiParam({
    name: 'id',
    description: 'uuid room',
    example: 'uuid123',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  findOne(@Param('id') id: string) {
    return this.roomService.findOne(id);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Đổi trạng thái phòng',
    description: `
    Các transition hợp lệ:
    available → cleaning, maintenance
    cleaning → available
    maintenance → available
    occupied → cleaning
  `,
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của phòng',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Đổi trạng thái thành công',
    type: RoomResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Transition không hợp lệ hoặc phòng đã bị xóa',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateRoomStatus: UpdateRoomStatusDto,
  ): Promise<RoomResponseDto> {
    return this.roomService.updateStatus(id, updateRoomStatus);
  }

  @Patch(':id/images')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Sắp xếp hoặc xoá ảnh phòng',
    description:
      'Gửi danh sách ảnh cuối cùng. Ảnh không còn trong danh sách sẽ bị xoá khỏi S3.',
  })
  @ApiParam({ name: 'id', example: 'uuid-123' })
  @ApiResponse({ status: 200, type: RoomResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Danh sách chứa ảnh không thuộc phòng này',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  async updateImages(
    @Param('id') id: string,
    @Body() dto: UpdateRoomImagesDto,
  ): Promise<RoomResponseDto> {
    return this.roomService.updateImages(id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Cập nhật phòng',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của phòng',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật phòng thành công',
    type: RoomResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc room type không active',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phòng hoặc loại phòng',
  })
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomService.update(id, updateRoomDto);
  }

  @Delete(':id/images')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Xóa ảnh của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Xóa ảnh thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  async removeImages(
    @Param('id') id: string,
    @Body() body: { imageUrls: string[] },
  ) {
    return this.roomService.removeImages(id, body.imageUrls);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Xóa mềm phòng',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của phòng',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa phòng thành công',
    schema: {
      example: {
        message: 'Room deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Phòng đã bị vô hiệu hóa trước đó',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phòng',
  })
  async remove(@Param('id') id: string) {
    await this.roomService.remove(id);

    return {
      message: 'Room deleted successfully',
    };
  }

  @Post(':id/images')
  @HttpCode(201)
  @Roles('manager', 'admin')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      // storage: memoryStorage(), // giữ file trong RAM để có file.buffer cho S3
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Thêm ảnh cho phòng',
    description:
      'Tải lên tối đa 10 ảnh một lần, mỗi ảnh dưới 5MB, định dạng jpeg/png/webp',
  })
  @ApiParam({ name: 'id', example: 'uuid-123' })
  @ApiResponse({ status: 201, description: 'Thêm ảnh thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  @UseInterceptors(
    FilesInterceptor('files', 10, { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async addImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.roomService.addImagesV2(id, files);
  }
}
