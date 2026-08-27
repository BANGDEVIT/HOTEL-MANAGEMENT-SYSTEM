// src/common/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisClient = new Redis({
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD') || undefined,
        });

        return {
          store: {
            get: (key: string) =>
              redisClient.get(key).then((v) => (v ? JSON.parse(v) : null)),
            set: (key: string, value: unknown, ttl?: number) =>
              ttl
                ? redisClient.set(
                    key,
                    JSON.stringify(value),
                    'EX',
                    Math.ceil(ttl / 1000),
                  )
                : redisClient.set(key, JSON.stringify(value)),
            del: (key: string) => redisClient.del(key),
            reset: () => redisClient.flushdb(),
            keys: (pattern: string) => redisClient.keys(pattern),
          },
        };
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
