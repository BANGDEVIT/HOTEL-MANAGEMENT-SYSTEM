import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

import {
  PaginatedShiftResponseDto,
  ResponseShiftDto,
  ShiftDetailResponseDto,
} from './dto/response-shift.dto';
import { QueryShiftDTO } from './dto/query-shift.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignEmployeeDto,
  AssignEmployeeResponseDto,
} from './dto/assign-employees.dto';
import { QueryScheduleDto } from './dto/schedule.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShiftDto): Promise<ResponseShiftDto> {
    const { name, day_of_week, start_time, end_time } = dto;

    const existingShift = await this.prisma.shift.findFirst({
      where: {
        name,
        day_of_week,
      },
    });

    if (existingShift) {
      throw new ConflictException(
        `Shift ${name} and ${day_of_week} have already exists`,
      );
    }

    if (start_time > end_time) {
      throw new BadRequestException('Start time is required small end_time ');
    }

    // ← Convert string "07:00" → Date
    const startDate = new Date(`1970-01-01T${start_time}:00`);
    const endDate = new Date(`1970-01-01T${end_time}:00`);

    const shift = await this.prisma.shift.create({
      data: {
        name,
        start_time: startDate,
        day_of_week,
        end_time: endDate,
      },
      select: {
        id: true,
        name: true,
        start_time: true,
        day_of_week: true,
        end_time: true,
      },
    });

    return {
      ...shift,
      start_time: shift.start_time.toTimeString().slice(0, 5), // → "07:00"
      end_time: shift.end_time.toTimeString().slice(0, 5), // → "11:00"
    };
  }

  async findAll(query: QueryShiftDTO): Promise<PaginatedShiftResponseDto> {
    const { page = 1, limit = 10, name, day_of_week: dayOfweek } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (name) {
      where.name = name;
    }

    if (dayOfweek) {
      where.day_of_week = dayOfweek;
    }

    const [shiftsRaw, totalShift] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          day_of_week: true,
          start_time: true,
          end_time: true,
          _count: {
            select: { employee_shifts: true }, // ← chỉ đếm số nhân viên
          },
        },
      }),
      this.prisma.shift.count({ where }),
    ]);

    const shifts = shiftsRaw.map((s) => ({
      ...s,
      start_time: s.start_time.toTimeString().slice(0, 5),
      end_time: s.end_time.toTimeString().slice(0.5),
      total_employees: s._count.employee_shifts,
    }));

    //   typescript// _count có thể đếm nhiều relation cùng lúc
    // _count: {
    //   select: {
    //     employee_shifts: true,  // ← đếm số nhân viên
    //     // có thể thêm nhiều relation khác
    //   }
    // }

    // // Kết quả trả về
    // s._count = {
    //   employee_shifts: 3  // ← object, không phải số trực tiếp
    // }

    // s._count              = { employee_shifts: 3 }  ← object
    // s._count.employee_shifts = 3                    ← số thực tế

    return {
      data: shifts,
      total: totalShift,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalShift / limit),
    };
  }

  async findOne(id: string): Promise<ShiftDetailResponseDto> {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        day_of_week: true,
        start_time: true,
        end_time: true,
        employee_shifts: {
          select: {
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
      throw new NotFoundException(`Không tìm thấy ca làm việc với id: ${id}`);
    }

    // Format employees
    const employees = shift.employee_shifts.map((es) => {
      const { first_name, last_name, ...rest } = es.employee;
      return {
        ...rest,
        full_name: `${last_name} ${first_name}`,
      };
    });

    return {
      id: shift.id,
      name: shift.name,
      day_of_week: shift.day_of_week,
      start_time: shift.start_time.toTimeString().slice(0, 5),
      end_time: shift.end_time.toTimeString().slice(0, 5),
      total_employees: employees.length,
      employees,
    };
  }

  async update(
    id: string,
    updateShiftDto: UpdateShiftDto,
  ): Promise<ResponseShiftDto> {
    const { name, day_of_week, start_time, end_time } = updateShiftDto;

    const shift = await this.prisma.shift.findUnique({
      where: { id },
    });

    if (!shift) {
      throw new NotFoundException('Shift dose not exist');
    }

    if (name || day_of_week) {
      const existing = await this.prisma.shift.findFirst({
        where: {
          name: name ?? shift.name,
          day_of_week: day_of_week ?? shift.day_of_week,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `shift ${name ?? shift.name} at ${day_of_week ?? shift.day_of_week} has already Exist`,
        );
      }
    }

    const updatedShift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(day_of_week && { day_of_week }),
        ...(start_time && {
          start_time: new Date(`1970-01-01T${start_time}:00`),
        }),
        ...(end_time && { end_time: new Date(`1970-01-01T${end_time}:00`) }),
      },
      select: {
        id: true,
        name: true,
        day_of_week: true,
        start_time: true,
        end_time: true,
      },
    });

    return {
      ...updatedShift,
      start_time: updatedShift.start_time.toTimeString().slice(0, 5),
      end_time: updatedShift.end_time.toTimeString().slice(0, 5),
    };
  }

  async remove(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employee_shifts: true },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('shift dose not exist');
    }

    if (shift._count.employee_shifts > 0) {
      throw new BadRequestException('Employees has this shift');
    }

    await this.prisma.shift.delete({ where: { id } });
  }

  async assignEmployees(
    shiftId: string,
    dto: AssignEmployeeDto,
  ): Promise<AssignEmployeeResponseDto> {
    const { employee_ids, work_date } = dto;

    // 1. Check shift tồn tại
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift does not Exist');
    }

    // 2. Check tất cả employee tồn tại
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employee_ids } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        position: true,
      },
    });

    const foudIds = employees.map((e) => e.id);
    const notFoundIds = employee_ids.filter((id) => !foudIds.includes(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Not found employee with id: ${notFoundIds.join(',')}`,
      );
    }

    // 3. Check những ai đã được phân công rồi → bỏ qua
    const existingAssignment = await this.prisma.employeeShift.findMany({
      where: {
        shift_id: shiftId,
        // work_date: new Date(work_date),
        employee_id: { in: employee_ids },
      },
      select: { employee_id: true },
    });

    const assignedIds = existingAssignment.map((e) => e.employee_id);

    // Lọc ra những người chưa được phân công
    const newEmployeeIds = employee_ids.filter((e) => !assignedIds.includes(e));

    if (newEmployeeIds.length === 0) {
      throw new ConflictException('All employees already has assign in shift');
    }

    // 4. Tạo records mới
    await this.prisma.employeeShift.createMany({
      data: newEmployeeIds.map((employee_id) => ({
        employee_id,
        shift_id: shiftId,
        work_date: new Date(work_date),
      })),
    });

    // 5. Format response
    const assignedEmployees = employees
      .filter((e) => newEmployeeIds.includes(e.id))
      .map((e) => ({
        id: e.id,
        full_name: `${e.last_name} ${e.first_name}`,
        position: e.position,
        work_date,
      }));

    return {
      shift_id: shiftId,
      shift_name: shift.name,
      day_of_week: shift.day_of_week,
      start_time: shift.start_time.toTimeString().slice(0, 5),
      end_time: shift.end_time.toTimeString().slice(0, 5),
      work_date: work_date,
      total_assigned: assignedEmployees.length,
      employees: assignedEmployees,
    };
  }

  async removeEmployee(
    shiftId: string,
    employeeId: string,
    work_date: string,
  ): Promise<void> {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift does not exist');
    }

    const existingEmployeeShift = await this.prisma.employeeShift.findFirst({
      where: {
        shift_id: shiftId,
        employee_id: employeeId,
        work_date: new Date(work_date),
      },
    });

    if (!existingEmployeeShift) {
      throw new NotFoundException(
        'The employee was not assigned to this shift on that day.',
      );
    }

    await this.prisma.employeeShift.delete({
      where: { id: existingEmployeeShift.id },
    });
  }

  async getSchedule(query: QueryScheduleDto) {
    const { search, work_date, week } = query;

    const where: any = {};

    if (work_date && week) {
      throw new BadRequestException(
        'Không thể dùng work_date và week cùng lúc',
      );
    }

    // Filter theo tên nhân viên
    if (search) {
      where.employee = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Filter theo ngày cụ thể
    if (work_date) {
      where.work_date = new Date(work_date);
    }

    // Filter theo tuần (thứ 2 → chủ nhật)
    if (week) {
      const date = new Date(week);
      const day = date.getDay(); // 0 = CN, 1 = T2...

      // Tính thứ 2 đầu tuần
      const monday = new Date(date);
      monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);

      // Tính chủ nhật cuối tuần
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      where.work_date = {
        gte: monday, // ← từ thứ 2
        lte: sunday, // ← đến chủ nhật
      };
    }

    const schedules = await this.prisma.employeeShift.findMany({
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
        shift: {
          select: {
            name: true,
            day_of_week: true,
            start_time: true,
            end_time: true,
          },
        },
      },
      orderBy: [{ work_date: 'asc' }, { shift: { start_time: 'asc' } }],
    });

    // Format response
    return schedules.map((s) => ({
      id: s.id,
      work_date: s.work_date.toISOString().slice(0, 10), // → "2026-05-12"
      employee: {
        id: s.employee.id,
        full_name: `${s.employee.last_name} ${s.employee.first_name}`,
        position: s.employee.position,
        avatar_url: s.employee.avatar_url,
      },
      shift: {
        name: s.shift.name,
        day_of_week: s.shift.day_of_week,
        start_time: s.shift.start_time.toTimeString().slice(0, 5),
        end_time: s.shift.end_time.toTimeString().slice(0, 5),
      },
    }));
  }
}
