import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { ServicesModule } from '../services/services.module';
import { S3Module } from '../../common/s3/s3.module';
import { MailModule } from '../../common/mail/mail.module';

/**
 * PrismaService và RedisService lấy giống RoomModule:
 * nếu RoomModule có `imports: [PrismaModule, RedisModule]` thì chép y vậy vào đây,
 * còn nếu 2 module đó là @Global() thì để trống như dưới.
 */

@Module({
  imports: [ServicesModule, S3Module, MailModule],
  providers: [BookingService],
  controllers: [BookingController],
  exports: [BookingService], // bước 3: cron no_show / hết hạn pending sẽ dùng lại
})
export class BookingModule {}
