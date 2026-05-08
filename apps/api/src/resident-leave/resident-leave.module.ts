import { Module } from '@nestjs/common';
import { ResidentLeaveController } from './resident-leave.controller';
import { ResidentLeaveService } from './resident-leave.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ResidentLeaveController],
  providers: [ResidentLeaveService],
})
export class ResidentLeaveModule {}
