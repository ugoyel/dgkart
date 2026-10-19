import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface AuthUser {
  id: string;
  phone: string;
  role: Role;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
