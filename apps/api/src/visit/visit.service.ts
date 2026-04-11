import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const MAX_VISITORS = 2;
const MAX_BOOKINGS_PER_DAY = 1;
const NO_SHOW_THRESHOLD = 3;

@Injectable()
export class VisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  // 查詢可預約時段（附剩餘名額）— 單次查詢避免 N+1
  async getAvailableSlots(zoneId: string, date: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: { timeSlots: { where: { isActive: true } } },
    });
    if (!zone) throw new NotFoundException('樓層區域不存在');

    // 一次性查詢該日期所有時段的已預約人數
    const bookings = await this.prisma.reservation.groupBy({
      by: ['timeSlotId'],
      where: {
        zoneId,
        visitDate: {
          gte: new Date(`${date}T00:00:00`),
          lt: new Date(new Date(`${date}T00:00:00`).getTime() + 86400000),
        },
        cancelledAt: null,
      },
      _sum: { guestCount: true },
    });

    const bookedMap = new Map(
      bookings.map((b) => [b.timeSlotId, b._sum.guestCount ?? 0]),
    );

    const slots = zone.timeSlots.map((slot) => {
      const totalBooked = bookedMap.get(slot.id) ?? 0;
      const remaining = zone.maxVisitorsPerSlot - totalBooked;
      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        remaining: Math.max(0, remaining),
        isFull: remaining <= 0,
      };
    });

    return { zone, date, slots };
  }

  // 建立預約（含 Transaction 原子性防超賣）
  async create(dto: {
    zoneId: string;
    timeSlotId: string;
    residentId: string;
    visitDate: string;
    visitorName: string;
    lineUserId: string;
    guestCount: number;
  }) {
    if (dto.guestCount < 1 || dto.guestCount > MAX_VISITORS) {
      throw new BadRequestException(`訪客人數限 1～${MAX_VISITORS} 人`);
    }

    const visitDate = new Date(dto.visitDate);
    const dateStr = dto.visitDate;

    // 驗證長者與家屬同棟（分棟限制）
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    const resident = await this.prisma.resident.findUnique({ where: { id: dto.residentId } });

    if (!zone || !resident) throw new NotFoundException('資料不存在');
    if (zone.building !== resident.building) {
      throw new BadRequestException('只能預約同棟別的長者，不可跨棟預約');
    }

    // 同一家屬同日頻率限制
    const sameDayBooking = await this.prisma.reservation.findFirst({
      where: {
        lineUserId: dto.lineUserId,
        visitDate: {
          gte: new Date(`${dateStr}T00:00:00`),
          lte: new Date(`${dateStr}T23:59:59`),
        },
        cancelledAt: null,
      },
    });

    if (sameDayBooking) {
      throw new ConflictException(`同一天只能預約 ${MAX_BOOKINGS_PER_DAY} 個時段`);
    }

    // Transaction 原子性名額檢查 + 建立預約
    return this.prisma.$transaction(async (tx) => {
      const booked = await tx.reservation.aggregate({
        where: {
          timeSlotId: dto.timeSlotId,
          visitDate: {
            gte: new Date(`${dateStr}T00:00:00`),
            lte: new Date(`${dateStr}T23:59:59`),
          },
          cancelledAt: null,
        },
        _sum: { guestCount: true },
      });

      const totalBooked = booked._sum.guestCount ?? 0;
      if (totalBooked + dto.guestCount > zone.maxVisitorsPerSlot) {
        throw new ConflictException('該時段名額已滿，請選擇其他時段');
      }

      const reservation = await tx.reservation.create({
        data: {
          ...dto,
          visitDate,
        },
        include: {
          zone: true,
          timeSlot: true,
          resident: true,
        },
      });

      return reservation;
    });
  }

  async cancel(id: string, lineUserId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('預約不存在');
    if (reservation.lineUserId !== lineUserId) {
      throw new BadRequestException('您只能取消自己的預約');
    }
    if (reservation.cancelledAt) {
      throw new BadRequestException('此預約已取消');
    }

    return this.prisma.reservation.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
  }

  // 後台：當日預約清單
  async getDailyDashboard(building: string, date: string) {
    const zones = await this.prisma.zone.findMany({
      where: { building, isActive: true },
      include: {
        timeSlots: { where: { isActive: true } },
        reservations: {
          where: {
            visitDate: {
              gte: new Date(`${date}T00:00:00`),
              lte: new Date(`${date}T23:59:59`),
            },
            cancelledAt: null,
          },
          include: { resident: true },
        },
      },
      orderBy: { floor: 'asc' },
    });

    return zones.map((zone) => ({
      zoneId: zone.id,
      label: zone.label,
      floor: zone.floor,
      totalReservations: zone.reservations.length,
      checkedIn: zone.reservations.filter((r) => r.checkedIn).length,
      reservations: zone.reservations,
    }));
  }

  // 報到
  async checkIn(id: string) {
    const res = await this.prisma.reservation.findUnique({ where: { id } });
    if (!res) throw new NotFoundException('預約不存在');
    return this.prisma.reservation.update({ where: { id }, data: { checkedIn: true } });
  }

  // 未出現名單
  async getNoShowList() {
    const lineUserIds = await this.prisma.reservation.groupBy({
      by: ['lineUserId'],
      where: { noShow: true, cancelledAt: null },
      _count: { id: true },
      having: { id: { _count: { gte: NO_SHOW_THRESHOLD } } },
    });

    return lineUserIds.map((r) => ({
      lineUserId: r.lineUserId,
      noShowCount: r._count.id,
    }));
  }

  // 區域設定（後台管理）
  async getZones(building?: string) {
    return this.prisma.zone.findMany({
      where: building ? { building } : undefined,
      include: { timeSlots: true },
      orderBy: [{ building: 'asc' }, { floor: 'asc' }],
    });
  }

  async updateZoneCapacity(zoneId: string, maxVisitorsPerSlot: number) {
    return this.prisma.zone.update({
      where: { id: zoneId },
      data: { maxVisitorsPerSlot },
    });
  }
}
