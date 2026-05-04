import {
  Controller, Post, Req, Res, HttpCode, HttpStatus, Logger,
  ForbiddenException, Headers,
  Get, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { validateSignature } from '@line/bot-sdk';
import { ConfigService } from '@nestjs/config';
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { LineBotService } from './line-bot.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class FaqDto {
  @IsString() keyword: string;
  @IsString() question: string;
  @IsString() answer: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class FaqUpdateDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() answer?: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('webhook')
export class LineBotController {
  private readonly logger = new Logger(LineBotController.name);
  private readonly channelSecret: string;

  constructor(
    private readonly lineBotService: LineBotService,
    private readonly config: ConfigService,
  ) {
    this.channelSecret = this.config.get<string>('LINE_CHANNEL_SECRET') ?? '';
  }

  @Post('line')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-line-signature') signature: string,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (this.channelSecret && rawBody) {
      const isValid = validateSignature(
        rawBody.toString('utf-8'),
        this.channelSecret,
        signature ?? '',
      );
      if (!isValid) {
        this.logger.warn('Line Webhook 簽名驗證失敗');
        throw new ForbiddenException('Invalid signature');
      }
    }

    const events = req.body?.events ?? [];
    await this.lineBotService.handleEvents(events);
    res.json({ status: 'ok' });
  }
}

@Controller('admin/faqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('includeInactive') inc?: string) {
    return this.prisma.faqEntry.findMany({
      where: inc === 'true' ? {} : { isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  @Post()
  create(@Body() dto: FaqDto) {
    return this.prisma.faqEntry.create({ data: dto });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: FaqUpdateDto) {
    return this.prisma.faqEntry.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.faqEntry.delete({ where: { id } });
  }
}
