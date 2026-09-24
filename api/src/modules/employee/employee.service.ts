import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  EmployeeResponseDto,
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
        { phone: { contains: search, mode: 'insensitive' } },
        { account: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (position) where.position = { contains: position, mode: 'insensitive' };
    if (gender) where.gender = { contains: gender, mode: 'insensitive' };

    const [employeesRaw, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        select: this.employeeSelect(),
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employeesRaw.map((em) => this.transformEmployee(em)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<EmployeeResponseDto> {
    const employeeRaw = await this.prisma.employee.findUnique({
      where: { id },
      select: this.employeeSelect(),
    });

    if (!employeeRaw) {
      throw new NotFoundException(`Không tìm thấy nhân viên với id: ${id}`);
    }
    return this.transformEmployee(employeeRaw);
  }

  async create(
    createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
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
      throw new ConflictException('Email đã được sử dụng');
    }

    // Không cho tạo tài khoản quản trị viên qua API — admin chỉ tạo bằng seed
    if (role === 'admin') {
      throw new ForbiddenException(
        'Không thể tạo tài khoản quản trị viên từ đây',
      );
    }

    const roleRecord = await this.prisma.role.findUnique({
      where: { name: role },
    });
    if (!roleRecord) {
      throw new NotFoundException(`Vai trò ${role} không tồn tại`);
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const hashPassword = await bcrypt.hash(password, 10);

      const account = await tx.account.create({
        data: {
          email,
          hash_password: hashPassword,
          role_account: { create: { role_id: roleRecord.id } },
        },
      });

      return tx.employee.create({
        data: {
          account_id: account.id,
          first_name,
          last_name,
          email,
          phone,
          position,
          salary,
          hired_date: new Date(hired_date),
          gender,
        },
        select: this.employeeSelect(),
      });
    });

    return this.transformEmployee(employee);
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Nhân viên không tồn tại');
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
        throw new ConflictException('Email đã được sử dụng');
      }
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const accountData: Prisma.AccountUpdateInput = {};
      if (email) accountData.email = email;
      if (is_active !== undefined) accountData.is_active = is_active;

      if (Object.keys(accountData).length > 0) {
        await tx.account.update({
          where: { id: existingEmployee.account.id },
          data: accountData,
        });
      }

      return tx.employee.update({
        where: { id },
        data: {
          ...(first_name && { first_name }),
          ...(last_name && { last_name }),
          ...(email && { email }),
          ...(phone && { phone }),
          ...(position && { position }),
          ...(salary !== undefined && { salary }),
          ...(hired_date && { hired_date: new Date(hired_date) }),
          ...(gender && { gender }),
        },
        select: this.employeeSelect(),
      });
    });

    return this.transformEmployee(employee);
  }

  async resetPassword(id: string): Promise<void> {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Nhân viên không tồn tại');
    }

    // Thiếu biến môi trường sẽ khiến bcrypt.hash(undefined) ném lỗi khó hiểu
    const defaultPassword = this.configService.get<string>('RESET_PASSWORD');
    if (!defaultPassword) {
      throw new InternalServerErrorException(
        'Chưa cấu hình RESET_PASSWORD trong biến môi trường',
      );
    }

    const hashPassword = await bcrypt.hash(defaultPassword, 10);

    await this.prisma.account.update({
      where: { id: existingEmployee.account.id },
      data: { hash_password: hashPassword },
    });
  }

  /** Xoá mềm = khoá tài khoản. currentAccountId để chặn tự khoá chính mình */
  async remove(id: string, currentAccountId?: string): Promise<void> {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Nhân viên không tồn tại');
    }

    if (currentAccountId && existingEmployee.account_id === currentAccountId) {
      throw new BadRequestException('Không thể khoá tài khoản của chính bạn');
    }

    if (!existingEmployee.account.is_active) {
      throw new BadRequestException('Tài khoản này đã bị khoá');
    }

    await this.prisma.account.update({
      where: { id: existingEmployee.account_id },
      data: { is_active: false },
    });
  }

  async getProfile(accountId: string): Promise<EmployeeProfileResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
      select: this.employeeSelect(),
    });

    if (!employee) {
      throw new NotFoundException('Nhân viên không tồn tại');
    }

    return this.transformEmployee(employee);
  }

  async updateProfile(
    accountId: string,
    updateProfile: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<EmployeeProfileResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
    });

    if (!employee) {
      throw new NotFoundException('Nhân viên không tồn tại');
    }

    let avatarUrl: string | undefined;

    if (file) {
      try {
        avatarUrl = await this.s3Service.uploadFile(file, 'avatars');
        if (employee.avatar_url) {
          await this.s3Service.deleteFile(employee.avatar_url).catch(() => {});
        }
      } catch {
        throw new InternalServerErrorException('Tải ảnh lên thất bại');
      }
    } else if (updateProfile.avatar_url) {
      avatarUrl = updateProfile.avatar_url;
    }

    const { first_name, last_name, phone, gender } = updateProfile;

    const updated = await this.prisma.employee.update({
      where: { account_id: accountId },
      data: {
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(phone && { phone }),
        ...(gender && { gender }),
        ...(avatarUrl && { avatar_url: avatarUrl }),
      },
      select: this.employeeSelect(),
    });

    return this.transformEmployee(updated);
  }

  async updatePassword(
    accountId: string,
    dto: UpdatePasswordDto,
  ): Promise<void> {
    const { email, password, newPassword } = dto;

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { email: true, hash_password: true },
    });

    if (!account) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    if (account.email !== email) {
      throw new BadRequestException('Email hoặc mật khẩu không đúng');
    }

    const isMatch = await bcrypt.compare(password, account.hash_password);
    if (!isMatch) {
      throw new BadRequestException('Email hoặc mật khẩu không đúng');
    }

    if (password === newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.account.update({
      where: { id: accountId },
      data: { hash_password: newHashedPassword },
    });
  }

  async getProfileShifts(accountId: string, query: QueryProfileShiftDto) {
    const { week, work_date } = query;

    if (week && work_date) {
      throw new BadRequestException(
        'Không thể dùng work_date và week cùng lúc',
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { account_id: accountId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    const where: Prisma.EmployeeShiftWhereInput = { employee_id: employee.id };

    if (work_date) {
      where.work_date = new Date(`${work_date}T00:00:00Z`);
    } else {
      // Không truyền gì -> tuần hiện tại theo giờ VN. Mọi phép tính ngày đều dùng UTC.
      const anchor =
        week ??
        new Date().toLocaleDateString('sv-SE', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
      const d = new Date(`${anchor}T00:00:00Z`);
      const dow = d.getUTCDay(); // 0 = CN
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      where.work_date = { gte: monday, lte: sunday };
    }

    const shifts = await this.prisma.employeeShift.findMany({
      where,
      select: {
        id: true,
        work_date: true,
        shift: {
          select: { id: true, name: true, start_time: true, end_time: true }, // bỏ day_of_week
        },
      },
      orderBy: [{ work_date: 'asc' }, { shift: { start_time: 'asc' } }],
    });

    return shifts.map((s) => {
      // toISOString (UTC), KHÔNG dùng toTimeString (giờ local) -> không lệch 7 tiếng
      const start = s.shift.start_time.toISOString().slice(11, 16);
      const end = s.shift.end_time.toISOString().slice(11, 16);
      return {
        id: s.id,
        work_date: s.work_date.toISOString().slice(0, 10),
        shift: {
          id: s.shift.id,
          name: s.shift.name,
          start_time: start,
          end_time: end,
          is_overnight: end <= start,
        },
      };
    });
  }

  /**
   * Ca gần nhất CHƯA KẾT THÚC của nhân viên: đang diễn ra hoặc sắp tới.
   * Không có ca nào thì trả null.
   */

  private employeeSelect() {
    return {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
      position: true,
      gender: true,
      salary: true,
      hired_date: true,
      avatar_url: true,
      account: {
        select: {
          id: true,
          email: true,
          is_active: true,
          role_account: {
            select: { role: { select: { name: true } } },
          },
        },
      },
    };
  }

  /** Giữ nguyên first_name và last_name — FE cần cả hai để hiện tên và chữ viết tắt */
  private transformEmployee(employee: any): EmployeeResponseDto {
    // Tách role_account ra khỏi account, phần còn lại (id, email, is_active) giữ nguyên
    const { role_account, ...account } = employee.account;

    return {
      ...employee,
      full_name: `${employee.last_name} ${employee.first_name}`, // có dấu cách
      salary: Number(employee.salary), // Decimal -> number
      account: {
        ...account,
        roles: role_account.map((ra: any) => ra.role.name), // flatten
      },
    };
  }

  /** Trang cá nhân dùng full_name cho tiện hiển thị, nhưng vẫn giữ hai trường gốc */
  private transformProfile(employee: any): EmployeeProfileResponseDto {
    const base = this.transformEmployee(employee);
    return {
      ...base,
      full_name: `${employee.last_name} ${employee.first_name}`,
    };
  }
}
