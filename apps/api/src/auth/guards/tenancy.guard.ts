import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../auth.service';

const PERMITE_GERENCIA_KEY = 'permite-escritura-gerencia';
/** GERENCIA es de solo lectura: el guard le rechaza todo lo que no sea GET. Este decorador marca
 *  las pocas escrituras que sí le corresponden (ej. marcar sus notificaciones como leídas). */
export const PermiteGerencia = () => SetMetadata(PERMITE_GERENCIA_KEY, true);

const METODOS_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Resuelve y VALIDA el tenant activo.
 * El cliente indica la organización con el header `X-Org-Id`, pero el guard
 * confirma que el usuario autenticado tiene membership en ella. Así el
 * organizationId nunca se confía del cliente sin verificar.
 */
@Injectable()
export class TenancyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; organizationId?: string; rol?: string; membershipId?: string }>();

    const userId = req.user?.sub;
    const orgId = req.headers['x-org-id'];
    if (!userId) throw new ForbiddenException('No autenticado');
    if (typeof orgId !== 'string' || !orgId) {
      throw new ForbiddenException('Falta el header X-Org-Id');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });

    if (!membership) throw new ForbiddenException('No perteneces a esa organización');

    if (membership.rol === 'GERENCIA' && !METODOS_LECTURA.includes(req.method)) {
      const permitido = this.reflector.getAllAndOverride<boolean>(PERMITE_GERENCIA_KEY, [context.getHandler(), context.getClass()]);
      if (!permitido) throw new ForbiddenException('Tu rol es de solo lectura');
    }

    req.organizationId = orgId;
    req.rol = membership.rol;
    req.membershipId = membership.id;
    return true;
  }
}
