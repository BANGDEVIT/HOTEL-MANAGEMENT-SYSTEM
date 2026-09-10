import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDTO } from './dto/register.dto';
import { LoginResponseDto, RegisterResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../common/mail/mail.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private redis: RedisService,
  ) {}

  // register
  async register(registerDto: RegisterDTO): Promise<RegisterResponseDto> {
    const { email, password, firstName, lastName, phone } = registerDto;
    const exitingUser = await this.prisma.account.findUnique({
      where: { email },
    });

    if (exitingUser) {
      throw new ConflictException('User with this email already exitis');
    }

    const customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });

    if (!customerRole) {
      throw new InternalServerErrorException('Role customer not exists');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const hashPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        const account = await tx.account.create({
          data: {
            email,
            hash_password: hashPassword,
            role_account: {
              create: { role_id: customerRole.id },
            },
          },
        });

        // ← Khai báo type rõ ràng
        const customerSelect = {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        };

        let customer: {
          id: string;
          first_name: string;
          last_name: string;
          email: string | null;
        } | null = null;

        // Check walk-in trùng SĐT
        if (phone) {
          const existingWalkIn = await tx.customer.findFirst({
            where: {
              phone,
              account_id: null,
              source: 'walk_in',
            },
            select: customerSelect,
          });

          if (existingWalkIn) {
            // Link account vào Customer cũ
            customer = await tx.customer.update({
              where: { id: existingWalkIn.id },
              data: {
                account_id: account.id,
                email,
                registered_at: new Date(),
              },
              select: customerSelect,
            });
          }
        }

        // Nếu không tìm thấy walk-in → tạo Customer mới
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              account_id: account.id,
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
              source: 'online_registration',
              registered_at: new Date(),
            },
            select: customerSelect,
          });
        }

        return customer;
      });

      this.mailService
        .sendWelcome(email, {
          customerName: `${lastName} +${firstName} `,
          email,
          loginUrl: `${process.env.FRONTEND_URL}/login`,
        })
        .catch(() => {});

      return {
        user: result,
      };
    } catch (error) {
      console.error('Error during user registration:', error);
      throw new InternalServerErrorException(
        'An error occurred during registration',
      );
    }
  }

  //login
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;
    const account = await this.prisma.account.findUnique({
      where: { email },
      include: {
        role_account: {
          include: { role: true },
        },
      },
    });

    if (!account || !(await bcrypt.compare(password, account.hash_password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!account.is_active) {
      throw new UnauthorizedException('Account has been blocked');
    }

    const roles = account.role_account.map((ra) => ra.role.name);

    const tokens = await this.generateTokens(account.id, roles);
    await this.saveRefreshToken(account.id, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      account: {
        id: account.id,
        email: account.email,
        roles: roles,
      },
    };
  }

  // Generate token
  private async generateTokens(
    accountId: string,
    roles: string[],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: accountId, roles };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '15m',
        secret: this.configService.get<string>('JWT_SECRET'),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  // Save refreshToken
  private async saveRefreshToken(
    accountId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        account_id: accountId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // RefreshToken
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // 1. Verify refresh token
    let payload: { sub: string; roles: string[] };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalidate or expired');
    }

    // 2. Check token trong DB
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token not exists');
    }

    if (tokenRecord.is_revoked) {
      throw new UnauthorizedException('Refresh token was revoked');
    }

    if (tokenRecord.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token is expired');
    }

    // 3. Check account còn active không
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      include: {
        role_account: {
          include: { role: true },
        },
      },
    });

    if (!account || !account.is_active) {
      throw new UnauthorizedException('Account does not exist or is locked');
    }

    // 4. Gen access token mới
    const roles = account.role_account.map((ra) => ra.role.name);
    const newAccessToken = await this.jwtService.signAsync(
      { sub: account.id, roles },
      {
        expiresIn: '15m',
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );

    return { accessToken: newAccessToken };
  }
  // Logout
  // Client gọi POST /auth/logout
  // → Gửi kèm accessToken (header) + refreshToken (cookie)
  // → Server revoke refreshToken trong DB
  // → Server xóa cookie
  // → Client xóa accessToken khỏi memory
  async logout(
    accountId: string,
    refreshToken: string,
    accessToken: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        account_id: accountId,
        is_revoked: false,
      },
      data: { is_revoked: true },
    });

    if (accessToken) {
      await this.redis.blacklistToken(accessToken, 15 * 60);
    }
  }

  async logoutV2(
    payload: { sub: string; roles: string[]; exp: number },
    refreshToken: string,
    accessToken: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        account_id: payload.sub,
        is_revoked: false,
      },
      data: {
        is_revoked: true,
      },
    });

    if (accessToken) {
      const now = Math.floor(Date.now() / 1000);
      const ttl = payload.exp - now;

      if (ttl > 0) {
        await this.redis.blacklistToken(accessToken, ttl);
      }
    }
  }

  async logoutV3(accountId: string, accessToken: string, refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        account_id: accountId,
        is_revoked: false,
      },
      data: {
        is_revoked: true,
      },
    });

    const payload = this.jwtService.decode(accessToken) as { exp: number };
    if (payload?.exp) {
      const now = Math.floor(Date.now() / 1000);
      const ttl = payload.exp - now;

      if (ttl > 0) {
        await this.redis.blacklistToken(accessToken, ttl);
      }
    }
  }
}
