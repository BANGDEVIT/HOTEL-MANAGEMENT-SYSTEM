import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Shift, ShiftName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
import { QueryScheduleDto, ScheduleItemDto } from './dto/schedule.dto';

/**
 * "Hôm nay" của khách sạn tính theo giờ Việt Nam, KHÔNG theo giờ server.
 * Server Neon / Docker thường chạy UTC: 01:00 sáng ở VN vẫn là "hôm qua" ở UTC.
 */
const HOTEL_TZ = 'Asia/Ho_Chi_Minh';

/** Nhãn tiếng Việt, chỉ dùng cho message lỗi. FE có map nhãn riêng. */
const SHIFT_LABEL: Record<ShiftName, string> = {
  morning: 'Ca sáng',
  afternoon: 'Ca chiều',
  evening: 'Ca tối',
  night: 'Ca đêm',
};

type ShiftCore = Pick<Shift, 'id' | 'name' | 'start_time' | 'end_time'>;

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /* ============================================================
   *  HELPER THỜI GIAN
   *  Quy tắc chung: mọi Date đi vào / đi ra DB đều ở UTC.
   * ============================================================ */

  /**
   * "06:00" -> Date 1970-01-01T06:00:00Z.
   * BẮT BUỘC có "Z": cột @db.Time không lưu timezone, Prisma đọc ra luôn là UTC.
   * Ghi bằng giờ local mà đọc bằng UTC thì lệch đúng bằng offset server (VN = 7 tiếng).
   */
  private toTime(hhmm: string): Date {
    return new Date(`1970-01-01T${hhmm}:00Z`);
  }

  /** Date -> "06:00". Dùng toISOString (UTC), KHÔNG dùng toTimeString (local). */
  private fromTime(d: Date): string {
    return d.toISOString().slice(11, 16);
  }

  /** "2026-09-28" -> Date 00:00 UTC, khớp với cột @db.Date */
  private toDate(ymd: string): Date {
    return new Date(`${ymd}T00:00:00Z`);
  }

  /** Date của cột @db.Date -> "2026-09-28" */
  private fromDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Ngày hôm nay theo giờ VN, dạng "2026-09-23". Locale sv-SE in ra đúng YYYY-MM-DD */
  private todayYmd(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: HOTEL_TZ });
  }

  /** [thứ 2, chủ nhật] của tuần chứa ngày truyền vào — toàn bộ tính theo UTC */
  private weekRange(ymd: string): [Date, Date] {
    const d = this.toDate(ymd);
    const dow = d.getUTCDay(); // 0 = CN, 1 = T2 ... 6 = T7

    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return [monday, sunday];
  }

  private shiftSelect() {
    return { id: true, name: true, start_time: true, end_time: true } as const;
  }

  private toResponse(s: ShiftCore): ResponseShiftDto {
    const start = this.fromTime(s.start_time);
    const end = this.fromTime(s.end_time);
    return {
      id: s.id,
      name: s.name,
      start_time: start,
      end_time: end,
      // So sánh chuỗi "HH:mm" an toàn vì cùng độ dài và có số 0 đứng đầu
      is_overnight: end <= start,
    };
  }

  /** Chặn thao tác trên lịch đã qua — lịch cũ là dữ liệu chấm công, không sửa */
  private assertNotPast(ymd: string, action: string) {
    if (ymd < this.todayYmd()) {
      throw new BadRequestException(
        `Không thể ${action} cho ngày đã qua (${ymd})`,
      );
    }
  }

  /* ============================================================
   *  DANH MỤC CA
   * ============================================================ */

  async create(dto: CreateShiftDto): Promise<ResponseShiftDto> {
    const { name, start_time, end_time } = dto;

    const existing = await this.prisma.shift.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException(`${SHIFT_LABEL[name]} đã tồn tại`);
    }

    // KHÔNG chặn start > end: ca đêm 22:00 -> 06:00 là hợp lệ.
    // Chỉ chặn trùng khít (ca dài 0 hoặc 24 tiếng đều vô nghĩa).
    if (start_time === end_time) {
      throw new BadRequestException(
        'Giờ bắt đầu và giờ kết thúc không được trùng nhau',
      );
    }

    const shift = await this.prisma.shift.create({
      data: {
        name,
        start_time: this.toTime(start_time),
        end_time: this.toTime(end_time),
      },
      select: this.shiftSelect(),
    });

    return this.toResponse(shift);
  }

  async findAll(query: QueryShiftDTO): Promise<PaginatedShiftResponseDto> {
    const { page = 1, limit = 20, name } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ShiftWhereInput = {};
    if (name) {
      where.name = name; // enum -> so sánh bằng, không dùng contains
    }

    const today = this.toDate(this.todayYmd());

    const [rows, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip,
        take: limit,
        select: {
          ...this.shiftSelect(),
          _count: {
            // _count có thể lọc: chỉ đếm lượt phân công từ hôm nay trở đi
            select: {
              employee_shifts: { where: { work_date: { gte: today } } },
            },
          },
        },
        orderBy: { start_time: 'asc' }, // sáng -> chiều -> đêm
      }),
      this.prisma.shift.count({ where }),
    ]);

    return {
      data: rows.map((s) => ({
        ...this.toResponse(s),
        upcoming_assignments: s._count.employee_shifts,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ShiftDetailResponseDto> {
    const today = this.toDate(this.todayYmd());

    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: {
        ...this.shiftSelect(),
        employee_shifts: {
          // Chỉ lấy lịch sắp tới — lấy toàn bộ thì 1 năm sau là vài nghìn dòng
          where: { work_date: { gte: today } },
          orderBy: { work_date: 'asc' },
          select: {
            work_date: true,
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                avatar_url: true,
                phone: true,
                position: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca làm việc');
    }

    const upcoming = shift.employee_shifts.map((es) => {
      const { first_name, last_name, ...rest } = es.employee;
      return {
        ...rest,
        full_name: `${last_name} ${first_name}`,
        work_date: this.fromDate(es.work_date),
      };
    });

    return {
      ...this.toResponse(shift),
      total_upcoming: upcoming.length,
      upcoming,
    };
  }

  async update(id: string, dto: UpdateShiftDto): Promise<ResponseShiftDto> {
    const { name, start_time, end_time } = dto;

    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca làm việc');
    }

    if (name && name !== shift.name) {
      const duplicate = await this.prisma.shift.findUnique({ where: { name } });
      if (duplicate) {
        throw new ConflictException(`${SHIFT_LABEL[name]} đã tồn tại`);
      }
    }

    // Kiểm tra trùng giờ trên giá trị SAU KHI gộp — có thể chỉ gửi 1 trong 2 field
    const nextStart = start_time ?? this.fromTime(shift.start_time);
    const nextEnd = end_time ?? this.fromTime(shift.end_time);
    if (nextStart === nextEnd) {
      throw new BadRequestException(
        'Giờ bắt đầu và giờ kết thúc không được trùng nhau',
      );
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(start_time && { start_time: this.toTime(start_time) }),
        ...(end_time && { end_time: this.toTime(end_time) }),
      },
      select: this.shiftSelect(),
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca làm việc');
    }

    // Chỉ chặn khi còn lịch SẮP TỚI. Lịch cũ đã qua thì xoá theo luôn.
    const upcoming = await this.prisma.employeeShift.count({
      where: { shift_id: id, work_date: { gte: this.toDate(this.todayYmd()) } },
    });

    if (upcoming > 0) {
      throw new BadRequestException(
        `${SHIFT_LABEL[shift.name]} còn ${upcoming} lượt phân công sắp tới, hãy gỡ nhân viên trước khi xoá`,
      );
    }

    // 2 lệnh phải cùng thành công hoặc cùng thất bại
    await this.prisma.$transaction([
      this.prisma.employeeShift.deleteMany({ where: { shift_id: id } }),
      this.prisma.shift.delete({ where: { id } }),
    ]);
  }

  /* ============================================================
   *  PHÂN CÔNG
   * ============================================================ */

  async assignEmployees(
    shiftId: string,
    dto: AssignEmployeeDto,
  ): Promise<AssignEmployeeResponseDto> {
    const { employee_ids, work_date } = dto;

    this.assertNotPast(work_date, 'xếp ca');
    const workDate = this.toDate(work_date);

    // 1. Ca có tồn tại không
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      select: this.shiftSelect(),
    });
    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca làm việc');
    }

    // 2. Nhân viên có tồn tại + còn hoạt động không
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employee_ids } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        position: true,
        account: { select: { is_active: true } },
      },
    });

    const foundIds = employees.map((e) => e.id);
    const notFound = employee_ids.filter((id) => !foundIds.includes(id));
    if (notFound.length > 0) {
      throw new NotFoundException(
        `Không tìm thấy nhân viên: ${notFound.join(', ')}`,
      );
    }

    const locked = employees.filter((e) => !e.account.is_active);
    if (locked.length > 0) {
      throw new BadRequestException(
        `Tài khoản đã bị khoá, không thể xếp ca: ${locked
          .map((e) => `${e.last_name} ${e.first_name}`)
          .join(', ')}`,
      );
    }

    // 3. Ai đã có lịch trong NGÀY này (bất kể ca nào)
    //    Trước đây dòng work_date bị comment -> chỉ xếp được 1 lần / người / ca, vĩnh viễn
    const sameDay = await this.prisma.employeeShift.findMany({
      where: { work_date: workDate, employee_id: { in: employee_ids } },
      select: {
        employee_id: true,
        shift_id: true,
        shift: { select: { name: true } },
        employee: { select: { first_name: true, last_name: true } },
      },
    });

    // 3a. Đã ở đúng ca này -> bỏ qua êm, không báo lỗi
    const alreadyIds = sameDay
      .filter((a) => a.shift_id === shiftId)
      .map((a) => a.employee_id);

    // 3b. Đã ở ca KHÁC cùng ngày -> chặn (khớp với @@unique([employee_id, work_date]))
    const conflicts = sameDay.filter((a) => a.shift_id !== shiftId);
    if (conflicts.length > 0) {
      const detail = conflicts
        .map(
          (c) =>
            `${c.employee.last_name} ${c.employee.first_name} (đã có ${SHIFT_LABEL[c.shift.name]})`,
        )
        .join(', ');
      throw new ConflictException(
        `Mỗi nhân viên chỉ trực 1 ca mỗi ngày. Ngày ${work_date}: ${detail}`,
      );
    }

    // 4. Tạo phân công mới
    const newIds = employee_ids.filter((id) => !alreadyIds.includes(id));

    if (newIds.length > 0) {
      await this.prisma.employeeShift.createMany({
        data: newIds.map((employee_id) => ({
          employee_id,
          shift_id: shiftId,
          work_date: workDate,
        })),
        // 2 request cùng lúc: unique constraint chặn ở DB, cái sau bị bỏ qua thay vì lỗi 500
        skipDuplicates: true,
      });
    }

    // 5. Response
    return {
      shift: this.toResponse(shift),
      work_date,
      total_assigned: newIds.length,
      skipped: alreadyIds.length,
      employees: employees
        .filter((e) => newIds.includes(e.id))
        .map((e) => ({
          id: e.id,
          full_name: `${e.last_name} ${e.first_name}`,
          position: e.position,
        })),
    };
  }

  async removeEmployee(
    shiftId: string,
    employeeId: string,
    work_date: string,
  ): Promise<void> {
    this.assertNotPast(work_date, 'gỡ ca');

    // deleteMany trả về { count } -> khỏi phải findFirst rồi mới delete (1 query thay vì 2)
    const { count } = await this.prisma.employeeShift.deleteMany({
      where: {
        shift_id: shiftId,
        employee_id: employeeId,
        work_date: this.toDate(work_date),
      },
    });

    if (count === 0) {
      throw new NotFoundException(
        'Nhân viên không được phân công vào ca này trong ngày đó',
      );
    }
  }

  /* ============================================================
   *  LỊCH TỔNG HỢP
   * ============================================================ */

  async getSchedule(query: QueryScheduleDto): Promise<ScheduleItemDto[]> {
    const { search, work_date, week } = query;

    if (work_date && week) {
      throw new BadRequestException(
        'Không thể dùng work_date và week cùng lúc',
      );
    }

    const where: Prisma.EmployeeShiftWhereInput = {};

    if (search) {
      where.employee = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (work_date) {
      where.work_date = this.toDate(work_date);
    } else {
      // Không truyền gì -> tuần hiện tại. Trước đây trả về TOÀN BỘ lịch từ trước tới giờ.
      const [monday, sunday] = this.weekRange(week ?? this.todayYmd());
      where.work_date = { gte: monday, lte: sunday };
    }

    const rows = await this.prisma.employeeShift.findMany({
      where,
      select: {
        id: true,
        work_date: true,
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            position: true,
            avatar_url: true,
          },
        },
        shift: { select: this.shiftSelect() },
      },
      orderBy: [{ work_date: 'asc' }, { shift: { start_time: 'asc' } }],
    });

    return rows.map((r) => ({
      id: r.id,
      work_date: this.fromDate(r.work_date),
      employee: {
        id: r.employee.id,
        full_name: `${r.employee.last_name} ${r.employee.first_name}`,
        position: r.employee.position,
        avatar_url: r.employee.avatar_url,
      },
      shift: this.toResponse(r.shift),
    }));
  }
}
