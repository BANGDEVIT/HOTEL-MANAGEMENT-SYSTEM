import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      property: 'account', // ← thêm dòng này
    });
  }

  async validate(payload: { sub: string; roles: string[]; exp: number }) {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });

    // Account không tồn tại hoặc bị khóa
    if (!account || !account.is_active) {
      throw new UnauthorizedException('Account does not exists or is locked');
    }

    // Return này sẽ được gắn vào request.user
    return {
      sub: account.id,
      roles: payload.roles,
      exp: payload.exp,
    };
  }
}
