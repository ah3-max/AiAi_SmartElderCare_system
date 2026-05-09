import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
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
  @IsBoolean() agreedToTerms: boolean; // 同意電子簽章使用告知 + 個資蒐集告知
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

  // TWCA KYC：LIFF 請求驗證 URL，接著把使用者導去 TWCA 驗證頁
  @Get('kyc-init/:token')
  initKyc(@Param('token') token: string) {
    return this.contractService.initKyc(token);
  }

  // 家屬下載已簽署合約 PDF 副本（以 Token 驗證身份）
  @Get('pdf/:token')
  async downloadPdfByToken(@Param('token') token: string, @Res() res: Response) {
    const { buffer, filename } = await this.contractService.getPdfByToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // 取得合約範本 PDF（供 LIFF 嵌入顯示）
  @Get('template-pdf/:templateId')
  async getTemplatePdf(@Param('templateId') templateId: string, @Res() res: Response) {
    const { buffer, filename } = await this.contractService.getTemplatePdfBuffer(templateId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  // TWCA server-side callback：驗證成功後導回 LIFF
  @Get('twca-callback')
  async twcaKycCallback(
    @Query('referenceId') referenceId: string,
    @Query('resultCode') resultCode: string,
    @Query('timestamp') timestamp: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const { returnUrl } = await this.contractService.completeKycFromCallback({
      referenceId,
      resultCode,
      timestamp,
      signature,
    });
    return res.redirect(returnUrl);
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

  @Post('templates/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemplate(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('version') version: string,
  ) {
    if (!file) throw new BadRequestException('請上傳檔案');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'docx') {
      throw new BadRequestException('僅支援 Word (.docx) 格式，請將合約存為 .docx 後上傳');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('檔案大小不可超過 10MB');
    }
    return this.contractService.createTemplateFromFile({ title, version, file });
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

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.contractService.getPdfBuffer(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
