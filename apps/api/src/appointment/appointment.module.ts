import { Module } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import {
  AppointmentPublicController,
  AppointmentAdminController,
} from './appointment.controller';

@Module({
  providers: [AppointmentService],
  controllers: [AppointmentPublicController, AppointmentAdminController],
  exports: [AppointmentService],
})
export class AppointmentModule {}
