import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsArray, Min, Max,
} from 'class-validator';
import { AdmissionStatus, RoomType, Gender, AdlLevel } from '@prisma/client';
import { AdmissionService } from './admission.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateAdmissionDto {
  @IsString() applicantName: string;
  @IsString() contactPhone: string;
  @IsString() lineUserId: string;
  @IsString() relation: string;
  @IsBoolean() privacyConsent: boolean;
  @IsOptional() @IsString() referralSource?: string;
  @IsString() seniorName: string;
  @IsInt() @Min(1900) @Max(2026) birthYear: number;
  @IsEnum(Gender) gender: Gender;
  @IsOptional() @IsInt() adlScore?: number;
  @IsEnum(AdlLevel) adlLevel: AdlLevel;
  @IsOptional() @IsArray() medicalTags?: string[];
  @IsEnum(RoomType) preferredRoom: RoomType;
  @IsOptional() @IsString() expectedDate?: string;
}

class UpdateStatusDto {
  @IsEnum(AdmissionStatus) status: AdmissionStatus;
  @IsOptional() @IsString() contactNotes?: string;
  @IsOptional() @IsString() expectedDate?: string;
}

// 公開端點（LIFF 使用，不需要 JWT）
@Controller('admissions')
export class AdmissionPublicController {
  constructor(private readonly admissionService: AdmissionService) {}

  @Post()
  create(@Body() dto: CreateAdmissionDto) {
    return this.admissionService.create(dto);
  }

  @Get('status/:lineUserId')
  getStatus(@Param('lineUserId') lineUserId: string) {
    return this.admissionService.getStatusByLineUserId(lineUserId);
  }
}

// 後台管理端點（需 JWT）
@Controller('admin/admissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdmissionAdminController {
  constructor(private readonly admissionService: AdmissionService) {}

  @Get()
  findAll(
    @Query('status') status?: AdmissionStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.admissionService.findAll({ status, search, page, pageSize });
  }

  @Get('ineligible')
  ineligibleList() {
    return this.admissionService.findIneligibleList();
  }

  @Get('stats/referral')
  referralStats() {
    return this.admissionService.getReferralStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.admissionService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.admissionService.updateStatus(id, dto);
  }
}
