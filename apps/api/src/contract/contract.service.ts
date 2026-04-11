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

  // ===== Cron：每日檢查過期合約 =====
  @Cron('0 9 * * *', { timeZone: 'Asia/Taipei' })
  async expireContracts() {
    await this.prisma.contractTransaction.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }

  // ===== 後台：取得合約範本清單 =====
  async getTemplates() {
    return this.prisma.contractTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
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
