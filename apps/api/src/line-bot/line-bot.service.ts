import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi, webhook } from '@line/bot-sdk';
import { PrismaService } from '../prisma/prisma.service';

type WebhookEvent = webhook.Event;
type MessageEvent = webhook.MessageEvent;

const ADMISSION_STATUS_LABEL: Record<string, string> = {
  NEW: '新申請（待社工聯繫）',
  CONTACTED: '已聯繫',
  WAITLISTED: '候補中',
  ADMITTED: '已安排入住',
  CLOSED: '結案',
  INELIGIBLE: '不符合入住資格',
};

@Injectable()
export class LineBotService {
  private readonly logger = new Logger(LineBotService.name);
  private readonly client: messagingApi.MessagingApiClient;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new messagingApi.MessagingApiClient({
      channelAccessToken: config.get<string>('LINE_CHANNEL_ACCESS_TOKEN') ?? '',
    });
  }

  async handleEvents(events: WebhookEvent[]) {
    await Promise.all(events.map((event) => this.handleEvent(event)));
  }

  private async handleEvent(event: WebhookEvent) {
    if (event.type !== 'message') return;

    const msgEvent = event as MessageEvent;
    if (msgEvent.message.type !== 'text') return;

    const userMessage = (msgEvent.message as webhook.TextMessageContent).text.trim();
    const replyToken = msgEvent.replyToken;
    const lineUserId = msgEvent.source?.type === 'user' ? msgEvent.source.userId : undefined;

    if (!replyToken) return;

    const replyText = await this.resolveReply(userMessage, lineUserId);

    try {
      await this.client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
    } catch (err) {
      this.logger.error(`Line 回覆失敗: ${err}`);
    }
  }

  /** 優先順序：入住進度查詢 → 資料庫 FAQ → 預設回覆 */
  private async resolveReply(text: string, lineUserId?: string): Promise<string> {
    // 1. 入住進度查詢
    if (
      lineUserId
      && (text.includes('進度') || text.includes('申請狀態') || text === '查詢')
    ) {
      const applicant = await this.prisma.applicant.findFirst({
        where: { lineUserId, status: { in: ['NEW', 'CONTACTED', 'WAITLISTED', 'ADMITTED'] } },
        include: { seniorAssessment: true },
        orderBy: { createdAt: 'desc' },
      });
      if (applicant) {
        const senior = applicant.seniorAssessment?.seniorName ?? '';
        const statusLabel = ADMISSION_STATUS_LABEL[applicant.status] ?? applicant.status;
        return `【您的入住申請進度】\n長者：${senior}\n目前狀態：${statusLabel}\n申請日期：${applicant.createdAt.toLocaleDateString('zh-TW')}${applicant.expectedDate ? `\n預期入住日：${applicant.expectedDate.toLocaleDateString('zh-TW')}` : ''}`;
      }
      return '目前查無您的入住申請紀錄，若需申請請從下方選單點擊「入住預約」。';
    }

    // 2. 資料庫 FAQ 比對
    const faqs = await this.prisma.faqEntry.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
    const hit = faqs.find((f) => text.includes(f.keyword));
    if (hit) return hit.answer;

    // 3. 預設回覆
    return '您好，感謝您的訊息！\n可以試試以下關鍵字：\n・「收費」了解費用\n・「探訪」查看探訪時間\n・「入住」了解申請流程\n・「進度」查詢申請狀態\n或透過下方圖文選單選擇所需服務。';
  }
}
