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
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoomTypeService } from './room-type.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import {
  UpdateRoomTypeDto,
  UpdateRoomTypeStatusDto,
} from './dto/update-room-type.dto';
import { QueryRoomTypeDto } from './dto/query-room-type.dto';
import {
  PaginationRoomTypeResponseDto,
  RoomTypeAdminItemDto,
  RoomTypeResponseDto,
} from './dto/response-room-type.dto';
import { Roles } from '../../common/decorators/role-decorator';
import { Public } from '../../common/decorators/public.decorator';

/** Chỉ nhận UUID v4, sai định dạng -> 400 trước khi chạm DB */
const RoomTypeId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

/**
 * THỨ TỰ ROUTE: /manage phải khai báo TRƯỚC /:id, nếu không Nest hiểu "manage" là một :id.
 */
@ApiTags('room-types')
@ApiBearerAuth('JWT-auth')
@Controller('room-types')
export class RoomTypeController {
  constructor(private readonly roomTypeService: RoomTypeService) {}

  /* ============================ Công khai ============================ */

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Danh sách loại phòng đang kinh doanh',
    description:
      'Công khai (trang Phòng, trang khách đặt phòng). Tìm theo tên, phân trang',
  })
  @ApiResponse({ status: 200, type: PaginationRoomTypeResponseDto })
  findAll(
    @Query() query: QueryRoomTypeDto,
  ): Promise<PaginationRoomTypeResponseDto> {
    return this.roomTypeService.findAll(query);
  }

  /* ============================ Màn quản lý ============================ */

  @Get('manage')
  @Roles('staff', 'manager', 'admin')
  @ApiOperation({
    summary: 'Loại phòng cho màn quản lý',
    description:
      'Mọi loại (kể cả ngừng kinh doanh) kèm số phòng theo trạng thái, công suất và doanh thu tiền phòng 30 ngày, ' +
      'số booking sắp tới, sức chứa tối thiểu được phép, có xoá được không',
  })
  @ApiResponse({ status: 200, type: [RoomTypeAdminItemDto] })
  findAllForManage(): Promise<RoomTypeAdminItemDto[]> {
    return this.roomTypeService.findAllForManage();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Chi tiết loại phòng đang kinh doanh' })
  @ApiParam({ name: 'id', description: 'UUID loại phòng' })
  @ApiResponse({ status: 200, type: RoomTypeResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy / đã ngừng kinh doanh',
  })
  findOne(@RoomTypeId() id: string): Promise<RoomTypeResponseDto> {
    return this.roomTypeService.findOne(id);
  }

  @Post()
  @Roles('manager', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm loại phòng' })
  @ApiResponse({ status: 201, type: RoomTypeAdminItemDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 409,
    description: 'Trùng tên (không phân biệt hoa thường)',
  })
  create(@Body() dto: CreateRoomTypeDto): Promise<RoomTypeAdminItemDto> {
    return this.roomTypeService.create(dto);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Sửa loại phòng',
    description:
      'Đổi giá chỉ áp dụng cho booking tạo sau đó. Không giảm sức chứa dưới mức booking sắp tới đang cần',
  })
  @ApiParam({ name: 'id', description: 'UUID loại phòng' })
  @ApiResponse({ status: 200, type: RoomTypeAdminItemDto })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ / sức chứa thấp hơn booking sắp tới',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại phòng' })
  @ApiResponse({ status: 409, description: 'Trùng tên' })
  update(
    @RoomTypeId() id: string,
    @Body() dto: UpdateRoomTypeDto,
  ): Promise<RoomTypeAdminItemDto> {
    return this.roomTypeService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Bật / tắt kinh doanh',
    description:
      'Ngừng kinh doanh: không nhận booking mới cho loại này, booking đã có giữ nguyên',
  })
  @ApiParam({ name: 'id', description: 'UUID loại phòng' })
  @ApiResponse({ status: 200, type: RoomTypeAdminItemDto })
  setStatus(
    @RoomTypeId() id: string,
    @Body() dto: UpdateRoomTypeStatusDto,
  ): Promise<RoomTypeAdminItemDto> {
    return this.roomTypeService.setActive(id, dto.is_active);
  }

  @Delete(':id')
  @Roles('manager', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xoá hẳn loại phòng',
    description:
      'Chỉ khi chưa có phòng nào thuộc loại này. Đã có phòng -> 409, dùng ngừng kinh doanh',
  })
  @ApiParam({ name: 'id', description: 'UUID loại phòng' })
  @ApiResponse({ status: 200, description: 'Đã xoá' })
  @ApiResponse({ status: 409, description: 'Loại phòng đang có phòng' })
  async remove(@RoomTypeId() id: string): Promise<{ message: string }> {
    await this.roomTypeService.remove(id);
    return { message: 'Đã xoá loại phòng' };
  }
}
