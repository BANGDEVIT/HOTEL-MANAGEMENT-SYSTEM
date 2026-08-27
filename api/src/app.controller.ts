import { Controller, Get } from '@nestjs/common';
import { RedisService } from './common/redis/redis.service';
import { Public } from './common/decorators/public.decorator';

@Controller('test')
export class AppController {
  constructor(private readonly redis: RedisService) {}

  @Get('cache')
  @Public()
  async testCache() {
    // Set
    await this.redis.set(
      'test:key',
      { message: 'redis', time: new Date() },
      60,
    );

    // Get
    const value = await this.redis.get('test:key');

    return {
      success: true,
      value,
      message: 'redis is active',
    };
  }
}
