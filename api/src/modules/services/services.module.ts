import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/**
 * PrismaService lấy giống các module khác: nếu RoomModule có `imports: [PrismaModule]`
 * thì chép y vậy vào đây, còn PrismaModule là @Global() thì để trống như dưới.
 */
@Module({
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
