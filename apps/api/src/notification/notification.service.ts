import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi } from '@line/bot-sdk';

type Message = messagingApi.Message;
type TextMessage = messagingApi.TextMessage;
type FlexMessage = messagingApi.FlexMessage;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly lineClient: messagingApi.MessagingApiClient;

  constructor(private readonly config: ConfigService) {
    this.lineClient = new messagingApi.MessagingApiClient({
      channelAccessToken: this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN', ''),
    });
  }

  async pushToUser(lineUserId: string, messages: Message[]) {
    try {
      await this.lineClient.pushMessage({ to: lineUserId, messages });
    } catch (err) {
      this.logger.error(`Line 推播失敗 [${lineUserId}]: ${err}`);
    }
  }

  async notifyAdmin(message: string) {
    const token = this.config.get<string>('LINE_NOTIFY_TOKEN', '');
    if (!token) return;

    try {
      const body = new URLSearchParams({ message });
      await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (err) {
      this.logger.error(`Line Notify 失敗: ${err}`);
    }
  }

  buildAppointmentReminderMessage(params: {
    seniorName: string;
    apptDate: string;
    apptTime: string;
    hospital: string;
    department: string;
    responseUrl: string;
  }): FlexMessage {
    return {
      type: 'flex',
      altText: `長者就診提醒：${params.seniorName}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '長者就診提醒',
              color: '#ffffff',
              weight: 'bold',
              size: 'lg',
            },
          ],
          backgroundColor: '#2D7DD2',
          paddingAll: 'md',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'text', text: `長者姓名：${params.seniorName}`, size: 'sm' },
            { type: 'text', text: `就診日期：${params.apptDate}`, size: 'sm' },
            { type: 'text', text: `就診時間：${params.apptTime}`, size: 'sm' },
            { type: 'text', text: `醫院：${params.hospital}`, size: 'sm' },
            { type: 'text', text: `科別：${params.department}`, size: 'sm' },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '點此確認安排',
                uri: params.responseUrl,
              },
              style: 'primary',
              color: '#2D7DD2',
            },
          ],
        },
      },
    };
  }

  buildAdmissionConfirmMessage(seniorName: string): TextMessage {
    return {
      type: 'text',
      text: `您好，已收到 ${seniorName} 的入住詢問，社工將於 3 個工作天內與您聯繫。`,
    };
  }

  buildAdmissionStatusMessage(seniorName: string, status: string): TextMessage {
    const statusMap: Record<string, string> = {
      CONTACTED: '社工已與您完成初步聯繫，請等候後續通知。',
      WAITLISTED: '您的申請已進入候補名單，目前床位需候補中，有空床時將再次通知您。',
      ADMITTED: `恭喜！${seniorName} 已完成安排入住，請聯繫機構確認後續事宜。`,
      INELIGIBLE: `很遺憾，${seniorName} 目前不符合入住資格，詳情請聯繫機構社工。`,
      CLOSED: '您的申請案已結案，如有疑問請聯繫機構。',
    };

    return {
      type: 'text',
      text: statusMap[status] ?? '申請狀態已更新，請聯繫機構了解詳情。',
    };
  }

  buildVisitConfirmMessage(params: {
    visitDate: string;
    startTime: string;
    endTime: string;
    residentName: string;
    building: string;
    floor: number;
  }): TextMessage {
    return {
      type: 'text',
      text: `探訪預約成功！\n日期：${params.visitDate}\n時段：${params.startTime}～${params.endTime}\n探訪對象：${params.residentName}\n地點：${params.building}棟 ${params.floor}樓`,
    };
  }
}
