import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateFaqDto {
  keyword: string;
  question: string;
  answer: string;
  priority?: number;
}

export interface UpdateFaqDto {
  keyword?: string;
  question?: string;
  answer?: string;
  priority?: number;
  isActive?: boolean;
}

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.faqEntry.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  create(dto: CreateFaqDto) {
    return this.prisma.faqEntry.create({ data: dto });
  }

  async update(id: string, dto: UpdateFaqDto) {
    await this.findOne(id);
    return this.prisma.faqEntry.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.faqEntry.delete({ where: { id } });
  }

  private async findOne(id: string) {
    const entry = await this.prisma.faqEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('FAQ 項目不存在');
    return entry;
  }
}
