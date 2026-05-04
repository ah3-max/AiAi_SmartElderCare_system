import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { AppointmentStatus, ResponseSelection } from '@prisma/client';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class SubmitResponseDto {
  @IsString() appointmentId: string;
  @IsString() lineUserId: string;
  @IsEnum(ResponseSelection) responseSelection: ResponseSelection;
  @IsBoolean() needsTransport: boolean;
}

class ArrangeVehicleDto {
  @IsString() vehicleType: string;
}

class CreateAppointmentDto {
  @IsString() residentId: string;
  @IsString() apptDate: string;
  @IsString() apptTime: string;
  @IsString() hospital: string;
  @IsString() department: string;
}

// 公開端點（LIFF 使用）
@Controller('appointments')
export class AppointmentPublicController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post('response')
  submitResponse(@Body() dto: SubmitResponseDto) {
    return this.appointmentService.submitResponse(dto);
  }
}

// 後台管理端點
@Controller('admin/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentAdminController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get()
  findAll(
    @Query('building') building?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('date') date?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.appointmentService.findAll({ building, status, date, page, pageSize });
  }

  @Get('residents')
  listResidents(@Query('building') building?: string) {
    return this.appointmentService.listResidents(building);
  }

  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentService.create(dto);
  }

  @Patch(':id/vehicle')
  arrangeVehicle(@Param('id') id: string, @Body() dto: ArrangeVehicleDto) {
    return this.appointmentService.arrangeVehicle(id, dto.vehicleType);
  }
}
