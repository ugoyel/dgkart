import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, IS_PUBLIC_KEY, ROLES_KEY, Role } from './roles';

/**
 * Global guard: every route needs a valid Bearer JWT unless marked @Public().
 * @Roles(Role.ADMIN) additionally restricts a route to admins.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = this.jwt.verify(token);
        req.user = { id: payload.sub, phone: payload.phone, role: payload.role } as AuthUser;
      } catch {
        if (!isPublic) throw new UnauthorizedException('Invalid or expired token');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Login required');

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
