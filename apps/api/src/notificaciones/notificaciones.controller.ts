import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermiteGerencia, TenancyGuard } from '../auth/guards/tenancy.guard';
import { OrgId } from '../auth/decorators/org-id.decorator';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, TenancyGuard)
@PermiteGerencia() // marcar como leídas no cambia datos del negocio
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  listar(@OrgId() orgId: string, @Query('limite') limite?: string) {
    // Number('abc') = NaN y Prisma rechaza take: NaN con un 500; un valor inválido usa el default.
    const n = Number(limite);
    return this.notificaciones.listar(orgId, Number.isFinite(n) ? Math.trunc(n) : undefined);
  }

  @Post(':id/leer')
  marcarLeida(@OrgId() orgId: string, @Param('id') id: string) {
    return this.notificaciones.marcarLeida(orgId, id);
  }

  @Post('leer-todas')
  marcarTodasLeidas(@OrgId() orgId: string) {
    return this.notificaciones.marcarTodasLeidas(orgId);
  }
}
