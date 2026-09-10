import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy, // Tham số 1: "Dùng loại strategy nào?" → JWT
  'jwt-refresh', // Tham số 2: "Đặt tên gì cho nó?"     → 'jwt-refresh'
) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; roles: string[] }) {
    // console.log('RefreshTokenStrategy.validate called');
    // console.log('Payload', { sub: payload.sub, email: payload.roles });

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header found');
      throw new UnauthorizedException('Refresh token not provided');
    }

    const refreshToken = authHeader.replace('Bearer', '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token is empty after extraction',
      );
    }

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token invalidate');
    }

    if (tokenRecord.is_revoked) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    if (tokenRecord.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token đã hết hạn');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });

    if (!account || !account.is_active) {
      throw new UnauthorizedException('Account does not exists or is locked');
    }

    return { sub: account.id, roles: payload.roles };
  }
}
