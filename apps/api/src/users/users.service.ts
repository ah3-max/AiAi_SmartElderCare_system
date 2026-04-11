import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface CreateUserDto {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  building?: string;
  floor?: number;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  building?: string;
  floor?: number;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        building: true,
        floor: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(building?: string) {
    return this.prisma.user.findMany({
      where: building ? { building } : undefined,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        building: true,
        floor: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('使用者名稱已存在');

    const hashed = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { ...dto, password: hashed },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        building: true,
        floor: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOrFail(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        building: true,
        floor: true,
        isActive: true,
      },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOrFail(id);
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed, loginAttempts: 0, lockedUntil: null },
    });
  }

  private async findOrFail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('使用者不存在');
    return user;
  }
}
