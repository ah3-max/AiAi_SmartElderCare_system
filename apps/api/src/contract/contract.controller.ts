import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsString, IsBoolean, IsOptional, IsInt, IsPositive, MaxLength } from 'class-validator';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class SendContractDto {
  @IsString() contractTemplateId: string;
  @IsString() residentId: string;
  @IsString() familyMemberId: string;
  @IsOptional() @IsInt() @IsPositive() expiresInDays?: number;
}

class KycCallbackDto {
  @IsString() token: string;
  @IsBoolean() success: boolean;
}

class SubmitSignatureDto {
  @IsString() token: string;
  @IsString() @MaxLength(500000) signatureData: string; // Base64 簽名上限 500KB
  @IsBoolean() agreedToElectronic: boolean;
}

// 公開端點（LIFF 使用）
@Controller('contracts')
export class ContractPublicController {
  constructor(private readonly contractService: ContractService) {}

  @Get('token/:token')
  getByToken(@Param('token') token: string) {
    return this.contractService.getContractByToken(token);
  }

  @Post('kyc-callback')
  verifyKyc(@Body() dto: KycCallbackDto) {
    return this.contractService.verifyKyc(dto.token, dto.success);
  }

  @Post('sign')
  submitSignature(@Body() dto: SubmitSignatureDto, @Req() req: Request) {
    const signerIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '';
    return this.contractService.submitSignature({ ...dto, signerIp });
  }
}

// 後台管理端點
@Controller('admin/contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractAdminController {
  constructor(private readonly contractService: ContractService) {}

  @Get('templates')
  getTemplates() {
    return this.contractService.getTemplates();
  }

  @Post('send')
  send(@Body() dto: SendContractDto) {
    return this.contractService.sendContractNotification(dto);
  }

  @Get('stats')
  getStats() {
    return this.contractService.getStats();
  }

  @Get()
  findAll(
    @Query('building') building?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.contractService.findAll({ building, status, search, page, pageSize });
  }
}
