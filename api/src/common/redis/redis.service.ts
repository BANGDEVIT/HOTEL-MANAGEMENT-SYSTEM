import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  // Tạo một logger riêng cho RedisService
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  // ── Generic ───────────────────────────────────────────────
  async get<T>(key: string): Promise<T> {
    try {
      return (await this.cache.get<T>(key)) ?? null;
    } catch (e) {
      this.logger.error(`Redis GET error [${key}] : ${e}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlSeconds * 1000);
    } catch (e) {
      this.logger.error(`Redis SET error [${key}]: ${e}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (e) {
      this.logger.error(`Redis DEL error [${key}]: ${e}`);
    }
  }

  // ── Cache helper — tự động get hoặc set ──────────────────
  // "Nếu Redis đã có dữ liệu → lấy ra. Nếu chưa có → chạy fn() để lấy dữ liệu thật, sau đó lưu vào Redis."
  async remember<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`Cache HIT: ${key}`);
      return cached;
    }
    this.logger.debug(`Cache MISS: ${key}`);
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // ── Xóa theo pattern ─────────────────────────────────────
  // Dùng khi bạn muốn xóa nhiều cache liên quan cùng lúc. delByPattern('hotel') tự động xóa hotel:1 hotel:2 hotel:3 hotel:4
  async delByPattern(pattern: string): Promise<void> {
    try {
      const store = (this.cache as any).store;
      const keys: string[] = await store.keys(`*[${pattern}]*`);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => this.cache.del(k)));
        this.logger.log(`Deleted ${keys.length} keys: "${pattern}"`);
      }
    } catch (e) {
      this.logger.error(`Redis DEL PATTERN error: ${e}`);
    }
  }

  // ── Token Blacklist ───────────────────────────────────────
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:${token}`, true, ttlSeconds);
  }

  async isBlacklistToken(token: string): Promise<boolean> {
    return !!(await this.get(`blacklist:${token}`)); // nếu chưa có trong redis thì trả về null/undefined -> !! = false
  }
}
