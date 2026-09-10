import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryCustomerDto } from './dto/query-customers.dto';
import { PaginatedCustomerResponseDto } from './dto/customer-response.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/chang-password-customer.dto';
import { CreateGuestDto } from './dto/create-guest.dto';
import { S3Service } from '../../common/s3/s3.service';
import { LinkAccountDto } from './dto/link-account.dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  async createGuest(
    dto: CreateGuestDto,
    files?: {
      front_image?: Express.Multer.File[];
      back_image?: Express.Multer.File[];
    },
  ) {
    const { first_name, last_name, phone, email, id_card, nationality } = dto;

    if (phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: { phone },
      });
      if (existingPhone) {
        throw new ConflictException(`Số điện thoại ${phone} đã tồn tại`);
      }
    }

    let frontUrl: string | undefined;
    let backUrl: string | undefined;

    if (files?.front_image?.[0]) {
      frontUrl = await this.s3Service.uploadFile(
        files.front_image[0],
        'customers/id-cards',
      );
    }
    if (files?.back_image?.[0]) {
      backUrl = await this.s3Service.uploadFile(
        files.back_image[0],
        'customers/id-cards',
      );
    }

    const guest = await this.prisma.customer.create({
      data: {
        first_name,
        last_name,
        phone,
        email,
        id_card,
        nationality,
        id_card_img_url: frontUrl,
        id_card_img_back_url: backUrl,
        source: 'walk_in',
        account_id: null,
      },
      select: this.customerSelect(),
    });

    return this.transformCustomer(guest);
  }

  async findAll(
    query: QueryCustomerDto,
  ): Promise<PaginatedCustomerResponseDto> {
    const {
      page = 1,
      limit = 10,
      search,
      nationality,
      orderby = 'created_at',
      order = 'desc',
      source,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      // account: { is_active: true },
    };

    if (nationality) where.nationality = nationality;

    if (source) where.source = source;

    // Thêm filter has_account
    // where.account_id = { not: null }  ← chỉ lấy có tài khoản
    // where.account_id = null           ← chỉ lấy walk-in

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSortFields = [
      'first_name',
      'last_name',
      'reward_points',
      'created_at',
    ];
    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      validSortFields.includes(orderby)
        ? { [orderby]: order }
        : { created_at: 'desc' };

    const [customersRaw, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: this.customerSelect(),
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customersRaw.map((c) => this.transformCustomer(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: this.customerSelect(),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.transformCustomer(customer);
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    files?: {
      front_image?: Express.Multer.File[];
      back_image?: Express.Multer.File[];
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let frontUrl: string | undefined;
    let backUrl: string | undefined;

    if (files?.front_image?.[0]) {
      frontUrl = await this.s3Service.uploadFile(
        files.front_image[0],
        'customers/id-cards',
      );
      // Xóa ảnh cũ nếu tồn tại (tránh rác)
      if (customer.id_card_img_url) {
        await this.s3Service
          .deleteFile(customer.id_card_img_url)
          .catch(() => {});
      }
    }
    if (files?.back_image?.[0]) {
      backUrl = await this.s3Service.uploadFile(
        files.back_image[0],
        'customers/id-cards',
      );
      if (customer.id_card_img_back_url) {
        await this.s3Service
          .deleteFile(customer.id_card_img_back_url)
          .catch(() => {});
      }
    }

    // Tách account fields và customer fields
    const {
      is_active,
      first_name,
      last_name,
      phone,
      id_card,
      nationality,
      reward_points,
      // id_card_img_url,
      // id_card_img_back_url,
    } = updateCustomerDto;

    if (is_active !== undefined) {
      await this.prisma.account.update({
        where: { id: customer.account_id },
        data: { is_active },
      });
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(phone && { phone }),
        ...(id_card && { id_card }),
        ...(nationality && { nationality }),
        ...(reward_points != undefined && { reward_points }),
        // ← Thêm sau AWS S3
        ...(frontUrl && { id_card_img_url: frontUrl }),
        ...(backUrl && { id_card_img_back_url: backUrl }),
      },
      select: this.customerSelect(),
    });

    return this.transformCustomer(updatedCustomer);
  }

  async remove(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!customer.account.is_active) {
      throw new BadRequestException('The account has been disabled');
    }

    await this.prisma.account.update({
      where: { id: customer.account_id },
      data: { is_active: false },
    });
  }

  async getProfile(accountId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { account_id: accountId },
      select: this.customerSelect(),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateProfile(
    accountId: string,
    updateCustomerProfileDto: UpdateCustomerProfileDto,
    files?: {
      id_card_img_url?: Express.Multer.File[];
      id_card_img_back_url?: Express.Multer.File[];
    },
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { account_id: accountId },
      include: { account: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let frontImageUrl: string | undefined;
    let backImageUrl: string | undefined;

    // Upload ảnh mới nếu có
    if (files?.id_card_img_url?.[0]) {
      frontImageUrl = await this.s3Service.uploadFile(
        files.id_card_img_url[0],
        'customers/id-cards',
      );
      // Xóa ảnh cũ nếu tồn tại (không throw lỗi)
      if (customer.id_card_img_url) {
        await this.s3Service
          .deleteFile(customer.id_card_img_url)
          .catch(() => {});
      }
    }

    if (files?.id_card_img_back_url?.[0]) {
      backImageUrl = await this.s3Service.uploadFile(
        files.id_card_img_back_url[0],
        'customers/id-cards',
      );
      if (customer.id_card_img_back_url) {
        await this.s3Service
          .deleteFile(customer.id_card_img_back_url)
          .catch(() => {});
      }
    }

    const {
      email,
      first_name,
      last_name,
      phone,
      id_card,
      nationality,
      reward_points,
      // id_card_img_url,      ← thêm sau AWS S3
      // id_card_img_back_url, ← thêm sau AWS S3
    } = updateCustomerProfileDto;

    if (email && email != customer.account.email) {
      const existingEmail = await this.prisma.account.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: { id: accountId },
          data: { email },
        });

        await tx.customer.update({
          where: { id: customer.id },
          data: { email },
        });
      });
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(phone && { phone }),
        ...(id_card && { id_card }),
        ...(nationality && { nationality }),
        ...(reward_points && { reward_points }),
        ...(frontImageUrl && { id_card_img_url: frontImageUrl }),
        ...(backImageUrl && { id_card_img_back_url: backImageUrl }),
      },
      select: this.customerSelect(),
    });

    return this.transformCustomer(updatedCustomer);
  }

  async changePassword(
    accountId: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    const { current_password, new_password } = changePasswordDto;

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      current_password,
      account.hash_password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check new password !== old password
    const isSamePassword = await bcrypt.compare(
      new_password,
      account.hash_password,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { hash_password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async linkAccount(
    customerId: string,
    dto: LinkAccountDto,
  ): Promise<{ message: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Not found customer');
    }

    if (customer.account_id) {
      throw new BadRequestException('Customer had account');
    }

    const existingAccount = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });

    if (existingAccount) {
      throw new ConflictException('Email has been already existed');
    }

    const customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });

    await this.prisma.$transaction(async (tx) => {
      const hashPassword = await bcrypt.hash(dto.password, 10);

      const account = await tx.account.create({
        data: {
          email: dto.email,
          hash_password: hashPassword,
          role_account: {
            create: { role_id: customerRole.id },
          },
        },
      });

      // Link account vào customer
      await tx.customer.update({
        where: { id: customerId },
        data: {
          account_id: account.id,
          registered_at: new Date(),
        },
      });
    });

    return { message: 'Link account successfully' };
  }

  private customerSelect() {
    return {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
      id_card: true,
      id_card_img_url: true,
      id_card_img_back_url: true,
      nationality: true,
      reward_points: true,
      updated_at: true,
      account: {
        select: {
          id: true,
          email: true,
          is_active: true,
        },
      },
    };
  }

  private transformCustomer(customer: any) {
    const { first_name, last_name, ...rest } = customer;
    return {
      ...rest,
      full_name: `${last_name} ${first_name}`,
    };
  }
}
