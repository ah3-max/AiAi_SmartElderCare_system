import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, ResponseSelection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';

const RESPONSE_LOCK_HOURS = 24;
const NOTIFICATION_DAYS = [7, 3, 1];

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly config: ConfigService,
  ) {}

  // ===== Cron：每日 08:00 掃描就診通知 =====
  @Cron('0 8 * * *', { timeZone: 'Asia/Taipei' })
  async sendDailyReminders() {
    this.logger.log('開始執行每日就診通知排程');
    const today = new Date();

    for (const daysBefore of NOTIFICATION_DAYS) {
      try {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysBefore);
        const dateStr = targetDate.toISOString().split('T')[0];

        // 排除當日有急診請假記錄的長者
        const dayStart = new Date(`${dateStr}T00:00:00`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999`);
        const emergencyLeaves = await this.prisma.residentLeave.findMany({
          where: {
            leaveType: 'EMERGENCY',
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
          select: { residentId: true },
        });
        const excludedResidentIds = emergencyLeaves.map((l) => l.residentId);

        const appointments = await this.prisma.appointment.findMany({
          where: {
            apptDate: { gte: dayStart, lt: dayEnd },
            status: { not: 'CANCELLED' },
            isUrgent: false,
            notifications: { none: { daysBefore } },
            residentId: excludedResidentIds.length
              ? { notIn: excludedResidentIds }
              : undefined,
          },
          include: {
            resident: { include: { familyMembers: true } },
          },
        });

        this.logger.log(`前${daysBefore}天通知：找到 ${appointments.length} 筆就診`);

        for (const appt of appointments) {
          try {
            // 若為前1天提醒，只發給已選擇「自行陪同」的家屬
            if (daysBefore === 1) {
              const response = await this.prisma.appointmentResponse.findUnique({
                where: { appointmentId: appt.id },
              });
              if (!response || response.responseSelection !== 'SELF_ACCOMPANY') continue;
            }

            const primaryContact = appt.resident.familyMembers.find(
              (fm) => fm.isPrimaryContact && fm.isVerified,
            );
            if (!primaryContact) continue;

            const liffBaseUrl = this.config.get<string>('LIFF_BASE_URL') ?? '';
            const responseUrl = `${liffBaseUrl}/appointment-response?id=${appt.id}&uid=${primaryContact.lineUserId}`;

            const msg = this.notification.buildAppointmentReminderMessage({
              seniorName: appt.resident.name,
              apptDate: appt.apptDate.toLocaleDateString('zh-TW'),
              apptTime: appt.apptTime,
              hospital: appt.hospital,
              department: appt.department,
              responseUrl,
            });

            await this.notification.pushToUser(primaryContact.lineUserId, [msg]);

            await this.prisma.appointmentNotification.create({
              data: { appointmentId: appt.id, daysBefore },
            });

            if (appt.status === 'PENDING') {
              await this.prisma.appointment.update({
                where: { id: appt.id },
                data: { status: 'NOTIFIED' },
              });
            }
          } catch (err) {
            this.logger.error(`就診通知發送失敗 [apptId=${appt.id}]: ${err}`);
            // 不中斷迴圈，繼續處理下一筆
          }
        }
      } catch (err) {
        this.logger.error(`就診通知排程異常 [daysBefore=${daysBefore}]: ${err}`);
      }
    }

    this.logger.log('每日就診通知排程執行完畢');
  }

  // ===== 家屬回覆就診安排 =====
  async submitResponse(params: {
    appointmentId: string;
    lineUserId: string;
    responseSelection: ResponseSelection;
    needsTransport: boolean;
  }) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: { resident: { include: { familyMembers: true } } },
    });

    if (!appt) throw new NotFoundException('就診記錄不存在');

    // 24 小時鎖定檢查
    const now = new Date();
    const apptDateTime = new Date(
      `${appt.apptDate.toISOString().split('T')[0]}T${appt.apptTime}`,
    );
    const hoursLeft = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < RESPONSE_LOCK_HOURS) {
      throw new ForbiddenException(
        '距就診時間不足24小時，無法線上回覆，請直接致電護理站。',
      );
    }

    // 驗證家屬 LineUserID
    const familyMember = appt.resident.familyMembers.find(
      (fm) => fm.lineUserId === params.lineUserId && fm.isVerified,
    );
    if (!familyMember) throw new ForbiddenException('您沒有回覆此就診的權限');

    const response = await this.prisma.appointmentResponse.upsert({
      where: { appointmentId: params.appointmentId },
      create: {
        appointmentId: params.appointmentId,
        familyMemberId: familyMember.id,
        responseSelection: params.responseSelection,
        needsTransport: params.needsTransport,
      },
      update: {
        responseSelection: params.responseSelection,
        needsTransport: params.needsTransport,
        responseTime: new Date(),
      },
    });

    await this.prisma.appointment.update({
      where: { id: params.appointmentId },
      data: { status: 'CONFIRMED' },
    });

    // 推播確認訊息給家屬
    const selectionLabel = params.responseSelection === 'SELF_ACCOMPANY' ? '家屬親自陪同' : '需機構協助';
    await this.notification.pushToUser(params.lineUserId, [
      {
        type: 'text',
        text: `您已確認 ${appt.resident.name} 於 ${appt.apptDate.toLocaleDateString('zh-TW')} ${appt.apptTime} 的就診安排：${selectionLabel}。${params.responseSelection === 'SELF_ACCOMPANY' ? '我們將於就診前一天再次提醒您。' : '機構將盡快安排交通，請留意後續通知。'}`,
      },
    ]);

    // 若需機構協助，通知行政人員
    if (params.responseSelection === 'NEED_ASSISTANCE') {
      await this.notification.notifyAdmin(
        `【就診需機構協助】${appt.resident.name} 於 ${appt.apptDate.toLocaleDateString('zh-TW')} ${appt.apptTime} 就診 ${appt.hospital}，家屬需要機構安排交通。`,
      );
    }

    // 通知護理端
    const nurseLineUserId = this.config.get<string>('NURSE_LINE_NOTIFY_TOKEN');
    if (nurseLineUserId) {
      await this.notification.notifyAdmin(
        `【就診安排情況】${appt.resident.name} ${appt.apptDate.toLocaleDateString('zh-TW')} ${appt.apptTime} ${appt.hospital} ${appt.department}，家屬回覆：${params.responseSelection === 'SELF_ACCOMPANY' ? '自行陪同' : '需機構協助'}`,
      );
    }

    return response;
  }

  // ===== 後台：行政人員輸入派車資訊 =====
  async arrangeVehicle(
    appointmentId: string,
    vehicleType: string,
  ) {
    const response = await this.prisma.appointmentResponse.findUnique({
      where: { appointmentId },
      include: {
        appointment: { include: { resident: { include: { familyMembers: true } } } },
        familyMember: true,
      },
    });

    if (!response) throw new NotFoundException('尚無家屬回覆記錄');

    await this.prisma.appointmentResponse.update({
      where: { appointmentId },
      data: { vehicleType, vehicleArrangedAt: new Date() },
    });

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CONFIRMED' },
    });

    // 通知家屬已安排
    const primaryContact = response.appointment.resident.familyMembers.find(
      (fm) => fm.isPrimaryContact,
    );
    if (primaryContact) {
      await this.notification.pushToUser(primaryContact.lineUserId, [
        {
          type: 'text',
          text: `【就診已安排】${response.appointment.resident.name} 於 ${response.appointment.apptDate.toLocaleDateString('zh-TW')} ${response.appointment.apptTime} 的就診車輛已安排完成，車種：${vehicleType}。`,
        },
      ]);
    }

    return { success: true };
  }

  async findAll(filters: {
    building?: string;
    status?: AppointmentStatus;
    date?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { building, status, date, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (building) where.resident = { building };
    if (date) {
      where.apptDate = {
        gte: new Date(`${date}T00:00:00`),
        lte: new Date(`${date}T23:59:59`),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          resident: true,
          response: true,
          notifications: true,
        },
        orderBy: { apptDate: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async create(data: {
    residentId: string;
    apptDate: string;
    apptTime: string;
    hospital: string;
    department: string;
  }) {
    return this.prisma.appointment.create({
      data: {
        ...data,
        apptDate: new Date(data.apptDate),
      },
      include: { resident: true },
    });
  }

  // 列出所有長者（供後台新增就診時選擇）
  async listResidents(building?: string) {
    const where: any = {};
    if (building) where.building = building;
    return this.prisma.resident.findMany({
      where,
      select: { id: true, name: true, building: true, floor: true, roomNo: true },
      orderBy: [{ building: 'asc' }, { floor: 'asc' }, { roomNo: 'asc' }],
    });
  }
}
