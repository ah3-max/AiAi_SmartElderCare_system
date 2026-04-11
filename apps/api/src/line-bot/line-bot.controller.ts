import {
  Controller, Post, Req, Res, HttpCode, HttpStatus, Logger,
  ForbiddenException, Headers,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { validateSignature } from '@line/bot-sdk';
import { ConfigService } from '@nestjs/config';
import { LineBotService } from './line-bot.service';

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
    // 驗證 Line 簽名，防止偽造事件
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
