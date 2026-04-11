import { Module } from '@nestjs/common';
import { AdmissionService } from './admission.service';
import {
  AdmissionPublicController,
  AdmissionAdminController,
} from './admission.controller';

@Module({
  providers: [AdmissionService],
  controllers: [AdmissionPublicController, AdmissionAdminController],
  exports: [AdmissionService],
})
export class AdmissionModule {}
