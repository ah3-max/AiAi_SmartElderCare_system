import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationModule } from './notification/notification.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdmissionModule } from './admission/admission.module';
import { AppointmentModule } from './appointment/appointment.module';
import { VisitModule } from './visit/visit.module';
import { ContractModule } from './contract/contract.module';
import { LineBotModule } from './line-bot/line-bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationModule,
    AuthModule,
    UsersModule,
    AdmissionModule,
    AppointmentModule,
    VisitModule,
    ContractModule,
    LineBotModule,
  ],
})
export class AppModule {}
