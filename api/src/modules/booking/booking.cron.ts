import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingActionsService } from './bookingActions.service';
import { HOTEL_TZ } from './booking.rules';

/**
 * Việc chạy nền mỗi ngày. Cần ScheduleModule.forRoot() trong AppModule.
 *
 * 12:05 = ngay sau giờ trả phòng 12:00:
 *   - khách đặt ngày hôm qua mà tới giờ này chưa đến -> no_show, nhả phòng
 *   - yêu cầu online hôm qua mà khách sạn chưa duyệt -> tự huỷ
 * Server tắt đúng lúc đó thì hôm sau cron vẫn bắt được (điều kiện là "< hôm nay"),
 * hoặc admin chạy bù bằng POST /bookings/housekeeping/run.
 */
@Injectable()
export class BookingCron {
  private readonly logger = new Logger(BookingCron.name);

  constructor(private readonly actions: BookingActionsService) {}

  @Cron('5 12 * * *', { name: 'booking-housekeeping', timeZone: HOTEL_TZ })
  async dailyHousekeeping() {
    try {
      const { expired, no_show } = await this.actions.runDailyHousekeeping();
      this.logger.log(
        `Tự huỷ ${expired} yêu cầu quá hạn, ${no_show} booking không đến`,
      );
    } catch (err) {
      // Cron lỗi không có ai nhận response -> phải log, không thì lỗi biến mất
      this.logger.error(
        'Housekeeping lỗi',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
