import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

/** Số phiên bản sống lâu hơn mọi dữ liệu cache (30 ngày) */
const VERSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  // ── Generic ───────────────────────────────────────────────
  async get<T>(key: string): Promise<T | null> {
    try {
      return (await this.cache.get<T>(key)) ?? null;
    } catch (e) {
      this.logger.error(`Redis GET error [${key}]: ${e}`);
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

  // ── Cache helper ──────────────────────────────────────────
  /**
   * Có trong cache -> trả luôn. Chưa có -> chạy fn() lấy dữ liệu thật rồi lưu lại.
   * Phần trước dấu ":" đầu tiên của key là NHÓM (VD "rooms", "room-types").
   * Key thật được gắn thêm số phiên bản của nhóm: "rooms:v3:available:..."
   */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const versionedKey = await this.withVersion(key);

    const cached = await this.get<T>(versionedKey);
    if (cached !== null) {
      this.logger.debug(`Cache HIT: ${versionedKey}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: ${versionedKey}`);
    const value = await fn();
    await this.set(versionedKey, value, ttlSeconds);
    return value;
  }

  // ── Xoá cả nhóm ───────────────────────────────────────────
  /**
   * Làm mọi cache của 1 nhóm hết hiệu lực: delByPattern('rooms:') hoặc delByPattern('rooms').
   * Không quét key: chỉ tăng số phiên bản -> lần đọc sau tự lấy dữ liệu mới,
   * key cũ không ai đọc nữa và tự hết hạn theo TTL.
   */
  async delByPattern(pattern: string): Promise<void> {
    const group = this.groupOf(pattern);
    try {
      const current =
        (await this.cache.get<number>(this.versionKey(group))) ?? 0;
      await this.cache.set(this.versionKey(group), current + 1, VERSION_TTL_MS);
      this.logger.log(`Cache "${group}" -> v${current + 1}`);
    } catch (e) {
      this.logger.error(`Redis INVALIDATE error [${group}]: ${e}`);
    }
  }

  // ── Token Blacklist ───────────────────────────────────────
  // KHÔNG đi qua remember/delByPattern -> không bao giờ bị xoá nhầm khi làm mới cache
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:${token}`, true, ttlSeconds);
  }

  async isBlacklistToken(token: string): Promise<boolean> {
    return !!(await this.get(`blacklist:${token}`));
  }

  // ── Helper ────────────────────────────────────────────────
  /** "rooms:available:..." -> "rooms";  "rooms:*" -> "rooms" */
  private groupOf(keyOrPattern: string): string {
    return keyOrPattern.split(':')[0].replace(/\*/g, '');
  }

  private versionKey(group: string) {
    return `ver:${group}`;
  }

  private async withVersion(key: string): Promise<string> {
    const group = this.groupOf(key);
    const version = (await this.cache.get<number>(this.versionKey(group))) ?? 0;
    return `${group}:v${version}${key.slice(group.length)}`;
  }
}
