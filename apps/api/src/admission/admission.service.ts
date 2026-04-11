import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AdmissionStatus, RoomType, Gender, AdlLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DUPLICATE_CHECK_DAYS = 30;
const PHONE_REGEX = /^09\d{2}-?\d{3}-?\d{3}$/;

export interface CreateAdmissionDto {
  // 申請人
  applicantName: string;
  contactPhone: string;
  lineUserId: string;
  relation: string;
  privacyConsent: boolean;
  referralSource?: string;
  // 長者評估
  seniorName: string;
  birthYear: number;
  gender: Gender;
  adlScore?: number;
  adlLevel: AdlLevel;
  medicalTags?: string[];
  // 預約需求
  preferredRoom: RoomType;
  expectedDate?: string;
}

export interface UpdateAdmissionStatusDto {
  status: AdmissionStatus;
  contactNotes?: string;
  expectedDate?: string;
}

@Injectable()
export class AdmissionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAdmissionDto) {
    // 驗證手機格式
    if (!PHONE_REGEX.test(dto.contactPhone)) {
      throw new BadRequestException('聯絡電話格式不正確，需符合 09xx-xxx-xxx');
    }

    // 個資同意必須勾選
    if (!dto.privacyConsent) {
      throw new BadRequestException('請同意個資蒐集聲明');
    }

    // 重複申請檢查：同一 LineUserID 30 天內是否有進行中申請
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DUPLICATE_CHECK_DAYS);

    const existing = await this.prisma.applicant.findFirst({
      where: {
        lineUserId: dto.lineUserId,
        status: { in: ['NEW', 'CONTACTED', 'WAITLISTED'] },
        createdAt: { gte: cutoff },
      },
    });

    if (existing) {
      throw new ConflictException('您已有進行中的申請，請勿重複建檔');
    }

    const { seniorName, birthYear, gender, adlScore, adlLevel, medicalTags, ...applicantData } = dto;

    return this.prisma.applicant.create({
      data: {
        ...applicantData,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        seniorAssessment: {
          create: {
            seniorName,
            birthYear,
            gender,
            adlScore,
            adlLevel,
            medicalTags: medicalTags ?? [],
          },
        },
      },
      include: { seniorAssessment: true },
    });
  }

  async findAll(filters: {
    status?: AdmissionStatus;
    building?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, search, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { applicantName: { contains: search, mode: 'insensitive' } },
        { seniorAssessment: { seniorName: { contains: search, mode: 'insensitive' } } },
        { contactPhone: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.applicant.findMany({
        where,
        include: { seniorAssessment: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.applicant.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: { seniorAssessment: true },
    });
    if (!applicant) throw new NotFoundException('申請案件不存在');
    return applicant;
  }

  async updateStatus(id: string, dto: UpdateAdmissionStatusDto) {
    const applicant = await this.findOne(id);

    // 狀態流程限制：新申請 → 候補中/結案 需先有聯繫紀錄或預約入住日期
    if (
      applicant.status === 'NEW' &&
      ['WAITLISTED', 'CLOSED'].includes(dto.status)
    ) {
      const hasNotes = dto.contactNotes || applicant.contactNotes;
      const hasDate = dto.expectedDate || applicant.expectedDate;
      if (!hasNotes && !hasDate) {
        throw new BadRequestException(
          '狀態變更至候補中或結案前，請先填寫聯繫紀錄或預約入住日期',
        );
      }
    }

    return this.prisma.applicant.update({
      where: { id },
      data: {
        status: dto.status,
        contactNotes: dto.contactNotes ?? applicant.contactNotes,
        expectedDate: dto.expectedDate
          ? new Date(dto.expectedDate)
          : applicant.expectedDate,
      },
      include: { seniorAssessment: true },
    });
  }

  async findIneligibleList() {
    return this.prisma.applicant.findMany({
      where: { status: 'INELIGIBLE' },
      include: { seniorAssessment: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getReferralStats() {
    const results = await this.prisma.applicant.groupBy({
      by: ['referralSource'],
      _count: { id: true },
    });
    return results.map((r) => ({
      source: r.referralSource ?? '未填寫',
      count: r._count.id,
    }));
  }

  // 查詢進度（給 Line 家屬端用）
  async getStatusByLineUserId(lineUserId: string) {
    const applicant = await this.prisma.applicant.findFirst({
      where: {
        lineUserId,
        status: { in: ['NEW', 'CONTACTED', 'WAITLISTED', 'ADMITTED'] },
      },
      include: { seniorAssessment: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!applicant) return null;

    return {
      id: applicant.id,
      seniorName: applicant.seniorAssessment?.seniorName,
      status: applicant.status,
      expectedDate: applicant.expectedDate,
      createdAt: applicant.createdAt,
    };
  }
}
