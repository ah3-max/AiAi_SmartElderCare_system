import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsString, IsBoolean, IsOptional, IsInt, IsPositive, MaxLength, IsArray } from 'class-validator';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class SendContractDto {
  @IsString() contractTemplateId: string;
  @IsString() residentId: string;
  @IsString() familyMemberId: string;
  @IsOptional() @IsInt() @IsPositive() expiresInDays?: number;
}

class CreateTemplateDto {
  @IsString() title: string;
  @IsString() contentHtml: string;
  @IsString() version: string;
}

class UpdateTemplateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() contentHtml?: string;
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
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

  @Post('reject')
  rejectElectronic(@Body() body: { token: string }) {
    return this.contractService.rejectElectronic(body.token);
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
  getTemplates(@Query('includeInactive') includeInactive?: string) {
    return this.contractService.getTemplates(includeInactive === 'true');
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.contractService.createTemplate(dto);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.contractService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.contractService.deleteTemplate(id);
  }

  @Post('send')
  send(@Body() dto: SendContractDto) {
    return this.contractService.sendContractNotification(dto);
  }

  @Get('stats')
  getStats() {
    return this.contractService.getStats();
  }

  @Post('batch-remind')
  batchRemind(@Body() body: { contractIds: string[] }) {
    return this.contractService.batchRemind(body.contractIds);
  }

  @Post('preview-notification')
  previewNotification(@Body() dto: SendContractDto) {
    return this.contractService.previewNotification(dto);
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
