import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationModule } from './notification/notification.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdmissionModule } from './admission/admission.module';
import { AppointmentModule } from './appointment/appointment.module';
import { VisitModule } from './visit/visit.module';
import { ContractModule } from './contract/contract.module';
import { LineBotModule } from './line-bot/line-bot.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { FaqModule } from './faq/faq.module';
import { ResidentLeaveModule } from './resident-leave/resident-leave.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'liff', 'dist'),
      serveRoot: '/liff',
      serveStaticOptions: { index: ['index.html'] },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },      // 每秒 10 req
      { name: 'medium', ttl: 60_000, limit: 100 },  // 每分鐘 100 req
    ]),
    PrismaModule,
    NotificationModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    AdmissionModule,
    AppointmentModule,
    VisitModule,
    ContractModule,
    LineBotModule,
    FaqModule,
    ResidentLeaveModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
