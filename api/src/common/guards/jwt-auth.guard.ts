import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private redis: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    // Check xem route có @Public() không → bỏ qua auth
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true; // ← route public thì không cần token

    const request = context.switchToHttp().getRequest();
    const token = request.headers?.authorization?.replace('Bearer ', '').trim();
    if (token && (await this.redis.isBlacklistToken(token))) {
      throw new UnauthorizedException(
        'Token đã bị thu hồi, vui lòng đăng nhập lại',
      );
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
