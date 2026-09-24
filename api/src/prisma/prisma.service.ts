import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Thiếu biến môi trường DATABASE_URL');
    }

    // Tự tạo Pool thay vì để adapter tạo ngầm, để còn gắn được pool.on('error')
    const pool = new Pool({
      connectionString,
      max: 10, // tối đa 10 kết nối, gói free của Neon giới hạn số kết nối đồng thời

      // Tự đóng kết nối rảnh sau 30s.
      // Nếu không đóng, Neon ngủ sẽ âm thầm cắt kết nối đó, lần query sau
      // lấy trúng kết nối "chết" -> "Connection terminated unexpectedly"
      idleTimeoutMillis: 30_000,

      // Chờ tối đa 15s để Neon thức dậy (mặc định là chờ vô hạn)
      connectionTimeoutMillis: 15_000,

      // Gửi gói TCP keepalive để phát hiện kết nối chết sớm hơn
      keepAlive: true,
    });

    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;

    // QUAN TRỌNG: kết nối đang rảnh trong pool bị server cắt thì pg phát ra
    // sự kiện 'error'. Không có listener thì Node coi là lỗi chưa xử lý -> CRASH cả app.
    // Có listener: pool tự bỏ kết nối hỏng, lần query sau mở kết nối mới.
    this.pool.on('error', (err) => {
      this.logger.warn(`Kết nối DB rảnh bị đóng: ${err.message}`);
    });
  }

  async onModuleInit() {
    // Khởi động app lúc Neon đang ngủ thì lần connect đầu dễ timeout -> thử lại vài lần
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Đã kết nối database');
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          this.logger.error('Không kết nối được database sau nhiều lần thử');
          throw err;
        }
        const delay = attempt * 2_000; // chờ 2s, 4s, 6s, 8s giữa các lần
        this.logger.warn(
          `Kết nối DB thất bại (lần ${attempt}/${maxAttempts}), thử lại sau ${delay / 1000}s`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  async onModuleDestroy() {
    // Tắt app thì đóng hết kết nối, tránh để kết nối treo bên phía Neon
    await this.$disconnect();
    await this.pool.end();
  }
}
