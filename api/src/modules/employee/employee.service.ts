import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto, UpdateProfileDto } from './dto/update-employee.dto';
import { QueryEmployeeDTO } from './dto/query-employee.dto';
import {
  EmployeeProfileResponseDto,
  PaginatedEmployeeResponseDto,
} from './dto/employee-response';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UpdatePasswordDto } from './dto/reset-password.dto';
import { QueryProfileShiftDto } from './dto/profile-employee.dto';
import { S3Service } from '../../common/s3/s3.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {}
  async findAll(
    query: QueryEmployeeDTO,
  ): Promise<PaginatedEmployeeResponseDto> {
    const { page = 1, limit = 10, search, position, gender } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (position) {
      where.position = { contains: position, mode: 'insensitive' };
    }

    if (gender) {
      where.gender = { contains: gender, mode: 'insensitive' };
    }

    const [employeesRaw, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          position: true,
          salary: true,
          hired_date: true,
          gender: true,
          avatar_url: true,
          account: {
            select: {
              id: true,
              email: true,
              is_active: true,
            },
          },
        },
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      }),

      this.prisma.employee.count({ where }),
    ]);

    const employees = employeesRaw.map((em) => {
      const { first_name, last_name, ...rest } = em;
      return {
        ...rest,
        full_name: `${last_name} ${first_name}`,
      };
    });

    return {
      data: employees,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const employeeRaw = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        position: true,
        avatar_url: true,
        salary: true,
        hired_date: true,
        gender: true,
        account: {
          select: {
            id: true,
            email: true,
            is_active: true,
          },
        },
      },
    });

    if (!employeeRaw) {
      throw new NotFoundException(`Không tìm thấy nhân viên với id: ${id}`);
    }

    const full_name = employeeRaw.last_name + employeeRaw.first_name;

    const employee = { ...employeeRaw, full_name };

    return employee;
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      position,
      salary,
      hired_date,
      gender,
      role,
    } = createEmployeeDto;

    const existingAccount = await this.prisma.account.findUnique({
      where: { email },
    });

    if (existingAccount) {
      throw new ConflictException('Email has already been used');
    }

    const roleRecord = await this.prisma.role.findUnique({
      where: { name: role },
    });

    if (!roleRecord) {
      throw new NotFoundException(`Role ${role} doesn not exist`);
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const hashPassword = await bcrypt.hash(password, 10);

      // 1. Tạo account
      const account = await tx.account.create({
        data: {
          email,
          hash_password: hashPassword,
          role_account: {
            create: { role_id: roleRecord.id },
          },
        },
      });

      // 2. Tạo employee
      const newEmployee = await tx.employee.create({
        data: {
          account_id: account.id,
          first_name,
          email,
          last_name,
          phone,
          position,
          salary,
          hired_date: new Date(hired_date),
          gender,
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          position: true,
          salary: true,
          hired_date: true,
          gender: true,
          avatar_url: true,
          account: {
            select: {
              id: true,
              email: true,
              is_active: true,
            },
          },
        },
      });
      return newEmployee;
    });

    const { first_name: fn, last_name: ln, ...rest } = employee;
    return {
      ...rest,
      full_name: `${ln} ${fn}`,
    };
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Employee does not exist');
    }

    const {
      email,
      first_name,
      last_name,
      phone,
      position,
      salary,
      hired_date,
      gender,
      is_active,
    } = updateEmployeeDto;

    if (email && email !== existingEmployee.account.email) {
      const existingEmail = await this.prisma.account.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new ConflictException('Email has been already exist');
      }
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const accountData: any = {};
      if (email) accountData.email = email;
      if (is_active !== undefined) accountData.is_active = is_active;

      if (Object.keys(accountData).length > 0) {
        await tx.account.update({
          where: { id: existingEmployee.account.id },
          data: accountData,
        });
      }

      return await tx.employee.update({
        where: { id: id },
        data: {
          ...(first_name && { first_name }),
          ...(last_name && { last_name }),
          ...(phone && { phone }),
          ...(position && { position }),
          ...(salary !== undefined && { salary }),
          ...(hired_date && { hired_date: new Date(hired_date) }),
          ...(gender && { gender }),
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          position: true,
          salary: true,
          hired_date: true,
          gender: true,
          account: { select: { id: true, email: true, is_active: true } },
        },
      });
    });

    const { first_name: fn, last_name: ln, ...rest } = employee;

    return {
      ...rest,
      full_name: `${ln} ${fn}`,
    };
  }

  async resetPassword(id: string): Promise<void> {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Employee does not Exist');
    }

    const hashPassword = await bcrypt.hash(
      this.configService.get<string>('RESET_PASSWORD'),
      10,
    );

    await this.prisma.account.update({
      where: { id: existingEmployee.account.id },
      data: { hash_password: hashPassword },
    });
  }

  async remove(id: string): Promise<void> {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: {
        id,
      },
      include: { account: true },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Emploiyee does not exist');
    }

    await this.prisma.account.update({
      where: { id: existingEmployee.account_id },
      data: {
        is_active: false,
      },
    });
  }

  async getProfile(id: string): Promise<EmployeeProfileResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        position: true,
        hired_date: true,
        gender: true,
        avatar_url: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee does not exist');
    }
    try {
      const { first_name, last_name, ...rest } = employee;
      const fullName: string = `${last_name} ${first_name}`;
      return {
        ...rest,
        full_name: fullName,
      };
    } catch (error) {
      console.error('Error during getProfile in Employee service:', error);
      throw new InternalServerErrorException(
        'An error occurred during getProfile in Employee service:',
      );
    }
  }

  async updateProfile(
    id: string,
    updateProfile: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<EmployeeProfileResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        account_id: id,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee does not exists');
    }

    let avatarUrl: string | undefined;

    // Xử lý upload ảnh mới nếu có file
    if (file) {
      try {
        avatarUrl = await this.s3Service.uploadFile(file, 'avatars');
        if (employee.avatar_url) {
          await this.s3Service.deleteFile(employee.avatar_url).catch(() => {});
        }
      } catch (error) {
        throw new InternalServerErrorException('Upload ảnh thất bại', error);
      }
    } else if (updateProfile.avatar_url) {
      // Nếu client gửi trực tiếp URL (trường hợp muốn cập nhật từ URL có sẵn)
      avatarUrl = updateProfile.avatar_url;
    }

    try {
      const { first_name, last_name, phone, gender } = updateProfile;

      const employeeUpdate = await this.prisma.employee.update({
        where: { account_id: id },
        data: {
          ...(first_name && { first_name }),
          ...(last_name && { last_name }),
          ...(phone && { phone }),
          ...(gender && { gender }),
          ...(avatarUrl && { avatar_url: avatarUrl }),
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          position: true,
          hired_date: true,
          gender: true,
          avatar_url: true,
        },
      });
      const { first_name: fn, last_name: ln, ...rest } = employeeUpdate;
      const fullName: string = `${ln} ${fn}`;
      return {
        ...rest,
        full_name: fullName,
      };
    } catch (error) {
      console.error('Error during update profile in Employee service:', error);
      throw new InternalServerErrorException(
        'An error occurred during update profile in Employee service:',
      );
    }
  }

  async updatePassword(accountId: string, dto: UpdatePasswordDto) {
    const { email, password, newPassword } = dto;
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { email: true, hash_password: true },
    });

    if (!account) {
      throw new NotFoundException('AcountId not exsits');
    }

    if (account.email !== email) {
      throw new BadRequestException('Email or password is incorrect');
    }

    const isMatch = await bcrypt.compare(password, account.hash_password);
    if (!isMatch) {
      throw new BadRequestException('Email or password is incorrect');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        hash_password: newHashedPassword,
      },
    });
  }

  async getProfileShifts(accountId: string, query: QueryProfileShiftDto) {
    const { week, work_date } = query;

    // Check không dùng cả 2 cùng lúc
    if (week && work_date) {
      throw new BadRequestException(
        'Do not filter work_date and web at the same time.',
      );
    }

    // Tìm employee theo accountId
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
    });

    if (!employee) {
      throw new NotFoundException('Employee does not exist');
    }

    const where: any = {
      employee_id: employee.id,
    };

    // Filter theo ngày cụ thể
    if (work_date) {
      where.work_date = new Date(work_date);
    }

    // Filter theo tuần
    if (week) {
      const date = new Date(week);
      const day = date.getDay();

      const monday = new Date(date);
      monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      where.work_date = {
        gte: monday,
        lte: sunday,
      };
    }

    const shifts = await this.prisma.employeeShift.findMany({
      where,
      select: {
        id: true,
        work_date: true,
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

    return shifts.map((s) => ({
      id: s.id,
      work_date: s.work_date.toISOString().slice(0, 10),
      shift: {
        name: s.shift.name,
        day_of_week: s.shift.day_of_week,
        start_time: s.shift.start_time.toTimeString().slice(0, 5),
        end_time: s.shift.end_time.toTimeString().slice(0, 5),
      },
    }));
  }
}
