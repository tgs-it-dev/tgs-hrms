import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { JwtPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayloadDto = (request as { user: JwtPayloadDto }).user;

    const userRole = (user?.role || '').toLowerCase();
    const normalizedRequired = (requiredRoles || []).map((r) => (r || '').toLowerCase());

    // System-admin-only routes: require exact role (no admin/network-admin equivalence)
    const onlySystemAdminRequired =
      normalizedRequired.length === 1 && normalizedRequired[0] === 'system-admin';
    if (onlySystemAdminRequired) {
      return userRole === 'system-admin';
    }

    const isAdminEquivalent = (role: string) =>
      role === 'admin' || role === 'system-admin' || role === 'network-admin' || role === 'hr-admin';

    if (normalizedRequired.includes(userRole)) return true;

    if (
      normalizedRequired.some(isAdminEquivalent) &&
      isAdminEquivalent(userRole)
    ) {
      return true;
    }

    return false;
  }
}
