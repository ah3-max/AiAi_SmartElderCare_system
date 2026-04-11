import { Module } from '@nestjs/common';
import { VisitService } from './visit.service';
import { VisitPublicController, VisitAdminController } from './visit.controller';

@Module({
  providers: [VisitService],
  controllers: [VisitPublicController, VisitAdminController],
  exports: [VisitService],
})
export class VisitModule {}
