import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { EmployeeModule } from './modules/employee/employee.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { RoomTypeModule } from './modules/room-type/room-type.module';
import { RoomModule } from './modules/room/room.module';
import { CustomersModule } from './modules/customers/customers.module';
import { BookingModule } from './modules/booking/booking.module';
import { S3Module } from './common/s3/s3.module';
import { ServicesModule } from './modules/services/services.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MailModule } from './common/mail/mail.module';
import { RedisModule } from './common/redis/redis.module';
import { AppThrottlerModule } from './common/throttler/throttler.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ← dùng được ở toàn app, không cần import lại
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    EmployeeModule,
    ShiftsModule,
    RoomTypeModule,
    RoomModule,
    CustomersModule,
    BookingModule,
    S3Module,
    ServicesModule,
    InvoiceModule,
    PaymentModule,
    MailModule,
    RedisModule,
    AppThrottlerModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // ← tất cả route đều cần auth // thoát nếu có @Public()
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, //  ← tất cả route đều cần // thoát nếu không có @Roles()
    },
  ],
})
export class AppModule {}
