import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { VisitService } from './visit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateReservationDto {
  @IsString() zoneId: string;
  @IsString() timeSlotId: string;
  @IsString() residentId: string;
  @IsString() visitDate: string;
  @IsString() visitorName: string;
  @IsString() lineUserId: string;
  @IsInt() @Min(1) @Max(2) guestCount: number;
}

class CancelReservationDto {
  @IsString() lineUserId: string;
}

class UpdateCapacityDto {
  @IsInt() @Min(1) maxVisitorsPerSlot: number;
}

// 公開端點（LIFF 使用）
@Controller('visits')
export class VisitPublicController {
  constructor(private readonly visitService: VisitService) {}

  @Get('residents')
  getResidents(@Query('lineUserId') lineUserId: string) {
    return this.visitService.getResidentsByLineUserId(lineUserId);
  }

  @Get('slots')
  getAvailableSlots(
    @Query('zoneId') zoneId: string,
    @Query('date') date: string,
  ) {
    return this.visitService.getAvailableSlots(zoneId, date);
  }

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.visitService.create(dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelReservationDto) {
    return this.visitService.cancel(id, dto.lineUserId);
  }
}

// 後台管理端點
@Controller('admin/visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitAdminController {
  constructor(private readonly visitService: VisitService) {}

  @Get('dashboard')
  getDailyDashboard(
    @Query('building') building: string,
    @Query('date') date: string,
  ) {
    return this.visitService.getDailyDashboard(building, date);
  }

  @Patch(':id/checkin')
  checkIn(@Param('id') id: string) {
    return this.visitService.checkIn(id);
  }

  @Get('no-show')
  getNoShowList() {
    return this.visitService.getNoShowList();
  }

  @Get('zones')
  getZones(@Query('building') building?: string) {
    return this.visitService.getZones(building);
  }

  @Patch('zones/:id/capacity')
  updateCapacity(@Param('id') id: string, @Body() dto: UpdateCapacityDto) {
    return this.visitService.updateZoneCapacity(id, dto.maxVisitorsPerSlot);
  }
}
