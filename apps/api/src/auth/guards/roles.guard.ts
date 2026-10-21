import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RolMiembro } from '@totalcrm/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Debe ir DESPUÉS de TenancyGuard: usa req.rol, que ese guard ya resolvió. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<RolMiembro[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { rol?: string }>();
    if (!req.rol || !rolesPermitidos.includes(req.rol as RolMiembro)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
