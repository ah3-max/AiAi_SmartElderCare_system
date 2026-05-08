import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResidentLeaveDto } from './dto/create-resident-leave.dto';
import { UpdateResidentLeaveDto } from './dto/update-resident-leave.dto';
import { QueryResidentLeaveDto } from './dto/query-resident-leave.dto';

const RESIDENT_SELECT = {
  id: true,
  name: true,
  building: true,
  floor: true,
} as const;

@Injectable()
export class ResidentLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  /** 確認操作者有權限存取該長者（ADMIN 無限制）*/
  private async assertResidentAccess(residentId: string, user: any): Promise<void> {
    if (user.role === 'ADMIN') return;

    const resident = await this.prisma.resident.findUnique({
      where: { id: residentId },
      select: { building: true },
    });
    if (!resident) throw new NotFoundException('找不到該長者');
    if (resident.building !== user.building) {
      throw new ForbiddenException('您只能管理所屬棟別的長者請假紀錄');
    }
  }

  /** 確認操作者有權限存取該請假紀錄（ADMIN 無限制）*/
  private async assertLeaveAccess(id: string, user: any) {
    const leave = await this.prisma.residentLeave.findUnique({
      where: { id },
      include: { resident: { select: RESIDENT_SELECT } },
    });
    if (!leave) throw new NotFoundException('找不到該請假紀錄');
    if (user.role !== 'ADMIN' && leave.resident.building !== user.building) {
      throw new ForbiddenException('您只能存取所屬棟別的長者請假紀錄');
    }
    return leave;
  }

  async findAll(query: QueryResidentLeaveDto, user: any) {
    const { residentId, leaveType, from, to, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (residentId) where.residentId = residentId;
    if (leaveType) where.leaveType = leaveType;
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.lte = new Date(to ?? from);
      where.endDate = {};
      if (to) where.endDate.gte = new Date(from ?? to);
      if (from) where.endDate.gte = new Date(from);
    }

    // 非 ADMIN 只能查看自己棟別的長者請假紀錄
    if (user.role !== 'ADMIN' && user.building) {
      where.resident = { building: user.building };
    }

    const [items, total] = await Promise.all([
      this.prisma.residentLeave.findMany({
        where,
        include: { resident: { select: RESIDENT_SELECT } },
        orderBy: { startDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.residentLeave.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string, user: any) {
    return this.assertLeaveAccess(id, user);
  }

  async create(dto: CreateResidentLeaveDto, user: any) {
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('請假開始日期不可晚於結束日期');
    }

    await this.assertResidentAccess(dto.residentId, user);

    return this.prisma.residentLeave.create({
      data: {
        residentId: dto.residentId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
        leaveType: dto.leaveType,
        notes: dto.notes,
      },
      include: { resident: { select: RESIDENT_SELECT } },
    });
  }

  async update(id: string, dto: UpdateResidentLeaveDto, user: any) {
    const leave = await this.assertLeaveAccess(id, user);

    const nextStart = dto.startDate ? new Date(dto.startDate) : leave.startDate;
    const nextEnd = dto.endDate ? new Date(dto.endDate) : leave.endDate;
    if (nextStart > nextEnd) {
      throw new BadRequestException('請假開始日期不可晚於結束日期');
    }

    return this.prisma.residentLeave.update({
      where: { id },
      data: {
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.leaveType !== undefined && { leaveType: dto.leaveType }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { resident: { select: RESIDENT_SELECT } },
    });
  }

  async remove(id: string, user: any) {
    await this.assertLeaveAccess(id, user);
    await this.prisma.residentLeave.delete({ where: { id } });
    return { message: '已刪除請假紀錄' };
  }
}
