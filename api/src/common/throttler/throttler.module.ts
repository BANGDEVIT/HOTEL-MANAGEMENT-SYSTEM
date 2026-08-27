// src/common/throttler/throttler.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        // dùng để tạo 1 object configuration cho module
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 60 }, // 60 req/phút mặc định
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // ← Global guard
    },
  ],
})
export class AppThrottlerModule {}
