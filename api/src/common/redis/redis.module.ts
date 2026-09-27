// src/common/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.getOrThrow<string>('REDIS_HOST');
        const port = config.getOrThrow<string>('REDIS_PORT');
        const password = config.get<string>('REDIS_PASSWORD');
        // encodeURIComponent: mật khẩu có ký tự đặc biệt (@, :, /) không làm hỏng URL
        const auth = password ? `:${encodeURIComponent(password)}@` : '';

        return {
          // cache-manager v7 CHỈ đọc "stores" (mảng Keyv). "store" cũ bị bỏ qua
          // -> trước đây cache lặng lẽ nằm trong RAM, không vào Redis
          stores: [createKeyv(`redis://${auth}${host}:${port}`)],
          ttl: 60_000, // mặc định 60 giây nếu set() không truyền ttl
        };
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
