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
} from '@nestjs/common';
import { RoomTypeService } from './room-type.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/role-decorator';
import {
  PaginationRoomTypeResponseDto,
  RoomTypeResponseDto,
} from './dto/response-room-type.dto';
import { QueryRoomTypeDto } from './dto/query-room-type.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('room-types')
@ApiBearerAuth('JWT-auth')
@Controller('room-types')
export class RoomTypeController {
  constructor(private readonly roomTypeService: RoomTypeService) {}

  @Post()
  @HttpCode(201)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Tạo mới kiểu phòng',
    description: 'Chỉ có quản lí mới có thể tạo kiểu phòng',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo loại phòng mới thành công',
    type: RoomTypeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 409, description: 'Loại phòng đã tồn tại' })
  async create(
    @Body() createRoomTypeDto: CreateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    return this.roomTypeService.create(createRoomTypeDto);
  }

  @Get()
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Xem tất cả loại phòng',
    description: 'Hỗ trợ filter theo tên và phân trang',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách loại phòng',
    type: PaginationRoomTypeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: QueryRoomTypeDto, // ← fix
  ): Promise<PaginationRoomTypeResponseDto> {
    return this.roomTypeService.findAll(query);
  }

  @Get(':id')
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Xem chi tiết loại phòng',
    description: 'Xem chi loại phòng. Chỉ có manager mới có quyền',
  })
  @ApiParam({
    name: 'id',
    description: 'uuid roomType',
    example: 'uuid123',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết loại phòng',
    type: RoomTypeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  async findOne(@Param('id') id: string): Promise<RoomTypeResponseDto> {
    return this.roomTypeService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Cập nhật loại phòng',
    description: 'Chỉ manager và admin mới có quyền cập nhật',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của loại phòng',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thành công',
    type: RoomTypeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  @ApiResponse({ status: 409, description: 'Tên loại phòng đã tồn tại' })
  async update(
    @Param('id') id: string,
    @Body() updateRoomTypeDto: UpdateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    return this.roomTypeService.update(id, updateRoomTypeDto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Xóa mềm loại phòng',
    description:
      'Chỉ manager và admin mới có quyền xóa. Không thể xóa nếu đang có phòng',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của loại phòng',
    example: 'uuid-123',
  })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 400, description: 'Loại phòng đang có phòng active' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.roomTypeService.remove(id);
    return { message: 'Xóa loại phòng thành công' };
  }
}
