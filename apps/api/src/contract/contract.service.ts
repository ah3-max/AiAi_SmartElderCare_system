import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

const KYC_MAX_ATTEMPTS = 3;

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly config: ConfigService,
  ) {}

  // ===== Cron：每日檢查過期合約 + 到期提醒 =====
  @Cron('0 9 * * *', { timeZone: 'Asia/Taipei' })
  async expireContracts() {
    // 標記已過期
    await this.prisma.contractTransaction.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    // 推播即將到期提醒（3 天內到期的待簽合約）
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);

    const expiringSoon = await this.prisma.contractTransaction.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gte: now, lte: threeDaysLater },
      },
      include: {
        familyMember: true,
        resident: true,
        contractTemplate: true,
      },
    });

    for (const tx of expiringSoon) {
      const liffBase = this.config.get<string>('LIFF_BASE_URL', '');
      await this.notification.pushToUser(tx.familyMember.lineUserId, [
        {
          type: 'text',
          text: `【合約簽署提醒】${tx.resident.name} 的「${tx.contractTemplate.title}」合約即將於 ${tx.expiresAt.toLocaleDateString('zh-TW')} 到期，請儘速完成簽署：\n${liffBase}/contract?token=${tx.token}`,
        },
      ]);
    }
  }

  // ===== 後台：取得合約範本清單 =====
  async getTemplates(includeInactive = false) {
    return this.prisma.contractTemplate.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(dto: { title: string; contentHtml: string; version: string }) {
    return this.prisma.contractTemplate.create({
      data: { ...dto, isActive: true },
    });
  }

  async updateTemplate(
    id: string,
    dto: { title?: string; contentHtml?: string; version?: string; isActive?: boolean },
  ) {
    const existing = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('合約範本不存在');
    return this.prisma.contractTemplate.update({ where: { id }, data: dto });
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.contractTemplate.findUnique({
      where: { id },
      include: { transactions: { take: 1 } },
    });
    if (!existing) throw new NotFoundException('合約範本不存在');
    // 已有合約記錄則僅停用（避免破壞外鍵約束）
    if (existing.transactions.length > 0) {
      return this.prisma.contractTemplate.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.contractTemplate.delete({ where: { id } });
  }

  // ===== 後台：發送合約簽署通知 =====
  async sendContractNotification(params: {
    contractTemplateId: string;
    residentId: string;
    familyMemberId: string;
    expiresInDays?: number;
  }) {
    const template = await this.prisma.contractTemplate.findUnique({
      where: { id: params.contractTemplateId },
    });
    const familyMember = await this.prisma.familyMember.findUnique({
      where: { id: params.familyMemberId },
      include: { resident: true },
    });

    if (!template || !familyMember) throw new NotFoundException('資料不存在');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? 30));

    const token = uuidv4();
    const transaction = await this.prisma.contractTransaction.create({
      data: {
        contractTemplateId: params.contractTemplateId,
        residentId: params.residentId,
        familyMemberId: params.familyMemberId,
        token,
        signerName: familyMember.name,
        expiresAt,
      },
    });

    const liffBase = this.config.get<string>('LIFF_BASE_URL', '');
    const signingUrl = `${liffBase}/contract?token=${token}`;

    await this.notification.pushToUser(familyMember.lineUserId, [
      {
        type: 'text',
        text: `【專屬簽署連結】${familyMember.resident.name} 的 ${template.title} 合約已準備好，請點擊以下連結進行身份驗證並完成簽署：\n${signingUrl}\n\n此連結將於 ${expiresAt.toLocaleDateString('zh-TW')} 到期，簽署完成後自動失效。`,
      },
    ]);

    return { transactionId: transaction.id, expiresAt };
  }

  // ===== LIFF：取得合約資訊（含長者資料預填） =====
  async getContractByToken(token: string) {
    const tx = await this.prisma.contractTransaction.findUnique({
      where: { token },
      include: {
        contractTemplate: true,
        resident: true,
        familyMember: true,
      },
    });

    if (!tx) throw new NotFoundException('合約連結不存在');
    if (tx.status === 'COMPLETED') throw new GoneException('此合約已完成簽署');
    if (tx.status === 'EXPIRED' || tx.expiresAt < new Date()) {
      throw new GoneException('此合約連結已過期，請聯繫機構重新發送');
    }

    // 檢查 KYC 鎖定
    if (tx.kycLockedAt) {
      throw new ForbiddenException(
        '驗證失敗次數過多，請洽機構行政人員重啟連結',
      );
    }

    return {
      transactionId: tx.id,
      template: {
        title: tx.contractTemplate.title,
        contentHtml: tx.contractTemplate.contentHtml,
        version: tx.contractTemplate.version,
      },
      resident: {
        name: tx.resident.name,
        building: tx.resident.building,
        floor: tx.resident.floor,
      },
      signerName: tx.signerName,
      expiresAt: tx.expiresAt,
      kycVerified: tx.kycVerified,
    };
  }

  // ===== LIFF：KYC 驗證結果回調 =====
  async verifyKyc(token: string, success: boolean) {
    const tx = await this.prisma.contractTransaction.findUnique({
      where: { token },
    });
    if (!tx) throw new NotFoundException('合約連結不存在');
    if (tx.kycLockedAt) throw new ForbiddenException('連結已鎖定');

    if (!success) {
      const attempts = tx.kycAttempts + 1;
      const locked = attempts >= KYC_MAX_ATTEMPTS;

      await this.prisma.contractTransaction.update({
        where: { token },
        data: {
          kycAttempts: attempts,
          kycLockedAt: locked ? new Date() : null,
        },
      });

      if (locked) {
        throw new ForbiddenException(
          '驗證失敗次數過多，請洽機構行政人員重啟連結',
        );
      }

      throw new BadRequestException(
        `身份驗證失敗（${attempts}/${KYC_MAX_ATTEMPTS}次），請重試`,
      );
    }

    await this.prisma.contractTransaction.update({
      where: { token },
      data: { kycVerified: true, kycAttempts: 0 },
    });

    return { success: true };
  }

  // ===== LIFF：提交簽名完成簽署 =====
  async submitSignature(params: {
    token: string;
    signatureData: string;
    signerIp: string;
    agreedToElectronic: boolean;
  }) {
    if (!params.agreedToElectronic) {
      throw new BadRequestException('請同意採用電子簽章');
    }

    const tx = await this.prisma.contractTransaction.findUnique({
      where: { token: params.token },
      include: {
        resident: true,
        familyMember: true,
        contractTemplate: true,
      },
    });

    if (!tx) throw new NotFoundException('合約連結不存在');
    if (tx.status === 'COMPLETED') throw new GoneException('此合約已完成簽署');
    if (tx.status === 'EXPIRED') throw new GoneException('此合約連結已過期');
    if (!tx.kycVerified) throw new ForbiddenException('請先完成身份驗證');

    // 更新簽署資訊（PDF 生成與 TWCA 數位簽章流程待串接）
    const updated = await this.prisma.contractTransaction.update({
      where: { token: params.token },
      data: {
        signatureData: params.signatureData,
        signerIp: params.signerIp,
        signedAt: new Date(),
        status: 'COMPLETED',
        // pdfPath 於 TWCA 串接後更新
      },
    });

    // 通知行政人員
    await this.notification.notifyAdmin(
      `【合約簽署完成】長者：${tx.resident.name}，簽署家屬：${tx.signerName}，合約：${tx.contractTemplate.title}，簽署時間：${new Date().toLocaleString('zh-TW')}`,
    );

    return { success: true, signedAt: updated.signedAt };
  }

  // ===== 後台：合約列表 =====
  async findAll(filters: {
    building?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { building, status, search, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (building) where.resident = { building };
    if (search) {
      where.OR = [
        { signerName: { contains: search, mode: 'insensitive' } },
        { resident: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.contractTransaction.findMany({
        where,
        include: { resident: true, familyMember: true, contractTemplate: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.contractTransaction.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ===== 後台：批次催簽通知 =====
  async batchRemind(contractIds: string[]) {
    const contracts = await this.prisma.contractTransaction.findMany({
      where: {
        id: { in: contractIds },
        status: 'PENDING',
      },
      include: { familyMember: true, resident: true, contractTemplate: true },
    });

    let sent = 0;
    const liffBase = this.config.get<string>('LIFF_BASE_URL', '');

    for (const tx of contracts) {
      await this.notification.pushToUser(tx.familyMember.lineUserId, [
        {
          type: 'text',
          text: `【合約簽署提醒】${tx.resident.name} 的「${tx.contractTemplate.title}」合約尚未完成簽署，將於 ${tx.expiresAt.toLocaleDateString('zh-TW')} 到期。\n請點擊以下連結完成簽署：\n${liffBase}/contract?token=${tx.token}`,
        },
      ]);
      sent++;
    }

    return { sent, total: contractIds.length };
  }

  // ===== 後台：通知預覽（預覽推播文案）=====
  async previewNotification(params: {
    contractTemplateId: string;
    residentId: string;
    familyMemberId: string;
  }) {
    const [template, familyMember, resident] = await Promise.all([
      this.prisma.contractTemplate.findUnique({ where: { id: params.contractTemplateId } }),
      this.prisma.familyMember.findUnique({ where: { id: params.familyMemberId } }),
      this.prisma.resident.findUnique({ where: { id: params.residentId } }),
    ]);

    if (!template || !familyMember || !resident) {
      throw new NotFoundException('資料不存在');
    }

    return {
      recipientName: familyMember.name,
      recipientLineUserId: familyMember.lineUserId,
      messagePreview: `【專屬簽署連結】${resident.name} 的 ${template.title} 合約已準備好，請點擊以下連結進行身份驗證並完成簽署：\n[簽署連結]\n\n此連結將於到期日前有效，簽署完成後自動失效。`,
    };
  }

  // ===== LIFF：拒絕電子簽署（改用紙本）=====
  async rejectElectronic(token: string) {
    const tx = await this.prisma.contractTransaction.findUnique({
      where: { token },
      include: { resident: true, familyMember: true, contractTemplate: true },
    });
    if (!tx) throw new NotFoundException('合約連結不存在');
    if (tx.status !== 'PENDING') throw new GoneException('此合約已非待簽署狀態');

    await this.prisma.contractTransaction.update({
      where: { token },
      data: { status: 'EXPIRED' },
    });

    // 通知行政人員
    await this.notification.notifyAdmin(
      `\n【家屬拒絕電子簽署】\n長者：${tx.resident.name}\n家屬：${tx.familyMember.name}\n合約：${tx.contractTemplate.title}\n家屬選擇改用紙本簽署，請安排紙本流程。`,
    );

    return { success: true, message: '已通知機構，將改用紙本簽署方式。' };
  }

  async getStats() {
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    const [pending, expiringSoon, completed] = await Promise.all([
      this.prisma.contractTransaction.count({ where: { status: 'PENDING' } }),
      this.prisma.contractTransaction.count({
        where: {
          status: 'PENDING',
          expiresAt: { gte: now, lte: thirtyDaysLater },
        },
      }),
      this.prisma.contractTransaction.count({ where: { status: 'COMPLETED' } }),
    ]);

    return { pending, expiringSoon, completed };
  }
}
