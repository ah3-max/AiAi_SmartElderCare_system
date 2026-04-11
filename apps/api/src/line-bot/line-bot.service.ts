import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi, webhook } from '@line/bot-sdk';

type WebhookEvent = webhook.Event;
type MessageEvent = webhook.MessageEvent;

const FAQ_RESPONSES: Record<string, string> = {
  收費: '本院收費標準依房型而定，單人房每月約 XX 元起，歡迎致電詢問詳細費用。',
  探訪: '探訪時間為每日 10:00-11:00 及 14:00-15:00，請透過 Line 預約探訪。',
  入住: '如需了解入住流程，請點選下方選單「入住預約」進行線上申請。',
  就診: '長者就診安排請至「就診通知」查看，如有緊急狀況請直接致電護理站。',
  聯絡: '本院電話：02-XXXX-XXXX，地址：台北市XXXX',
};

@Injectable()
export class LineBotService {
  private readonly logger = new Logger(LineBotService.name);
  private readonly client: messagingApi.MessagingApiClient;

  constructor(private readonly config: ConfigService) {
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

    const userMessage = (msgEvent.message as webhook.TextMessageContent).text;
    const replyToken = msgEvent.replyToken;

    const matched = Object.keys(FAQ_RESPONSES).find((key) =>
      userMessage.includes(key),
    );

    const replyText = matched
      ? FAQ_RESPONSES[matched]
      : '您好，感謝您的訊息！請透過下方選單選擇所需服務，或致電本院詢問。';

    if (!replyToken) return;

    try {
      await this.client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
    } catch (err) {
      this.logger.error(`Line 回覆失敗: ${err}`);
    }
  }
}
