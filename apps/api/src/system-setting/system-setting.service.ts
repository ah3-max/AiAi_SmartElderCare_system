import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);
  private cache: Map<string, string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async loadCache(): Promise<Map<string, string>> {
    const rows = await this.prisma.systemSetting.findMany();
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.value) map.set(row.key, row.value);
    }
    this.cache = map;
    return map;
  }

  private invalidateCache() {
    this.cache = null;
  }

  async get(key: string, defaultValue = ''): Promise<string> {
    const c = this.cache ?? (await this.loadCache());
    if (c.has(key)) return c.get(key)!;
    return this.config.get<string>(key, defaultValue);
  }

  async findAll() {
    const rows = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      value: row.isSensitive ? maskValue(row.value) : row.value,
    }));
  }

  async update(key: string, value: string) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException(`設定項目 ${key} 不存在`);

    const updated = await this.prisma.systemSetting.update({
      where: { key },
      data: { value },
    });
    this.invalidateCache();
    return {
      ...updated,
      value: updated.isSensitive ? maskValue(updated.value) : updated.value,
    };
  }
}
