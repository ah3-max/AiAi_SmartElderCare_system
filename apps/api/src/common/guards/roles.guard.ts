import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { BUILDING_KEY } from '../decorators/building.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requireBuilding = this.reflector.getAllAndOverride<boolean>(
      BUILDING_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // 系統管理員可存取所有資源
    if (user.role === 'ADMIN') return true;

    // 檢查角色權限
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('您沒有執行此操作的權限');
    }

    // 分層分棟檢查：若請求中帶有 building 參數，驗證是否與用戶所屬棟一致
    if (requireBuilding && user.building) {
      const requestBuilding =
        request.params?.building ||
        request.query?.building ||
        request.body?.building;

      if (requestBuilding && requestBuilding !== user.building) {
        throw new ForbiddenException('您只能存取所屬棟別的資料');
      }
    }

    return true;
  }
}
