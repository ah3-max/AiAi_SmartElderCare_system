import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    // 檢查是否鎖定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `登入失敗次數過多，帳號已鎖定至 ${user.lockedUntil.toLocaleTimeString('zh-TW')}`,
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const attempts = user.loginAttempts + 1;
      const lockedUntil =
        attempts >= MAX_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
          : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil },
      });

      if (lockedUntil) {
        throw new ForbiddenException(
          `登入失敗次數過多，帳號已暫時鎖定 ${LOCK_DURATION_MINUTES} 分鐘`,
        );
      }

      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    // 登入成功，重置失敗計數
    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      building: user.building,
      floor: user.floor,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '30d' },
      ),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        building: user.building,
        floor: user.floor,
      },
    };
  }

  /** 用 refresh token 換發新的 access token */
  async refresh(refreshToken: string) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('refresh token 無效或已過期');
    }
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('token 類型錯誤');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('帳號已停用');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      building: user.building,
      floor: user.floor,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
