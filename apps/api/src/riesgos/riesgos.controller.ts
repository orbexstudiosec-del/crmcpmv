import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { RiesgosService } from './riesgos.service';
import { analisisRiesgoInputSchema } from '@totalcrm/shared';
import type { RolMiembro } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { Rol } from '../auth/decorators/rol.decorator';
import { MembershipId } from '../auth/decorators/membership-id.decorator';

@Controller('riesgos')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
// GERENCIA entra para ver (solo lectura); el servicio limita qué puede hacer cada rol.
@Roles('OWNER', 'ADMIN', 'RIESGOS', 'SUPERVISOR', 'GERENCIA')
export class RiesgosController {
  constructor(private readonly riesgos: RiesgosService) {}

  @Get('resumen')
  resumen(@OrgId() orgId: string) {
    return this.riesgos.resumen(orgId);
  }

  /** Cola de prospectos calificados por analizar (equipo de riesgos). */
  @Get('cola')
  cola(@OrgId() orgId: string, @Rol() rol: RolMiembro, @MembershipId() membershipId: string | null) {
    return this.riesgos.cola(orgId, rol, membershipId);
  }

  /** Lista de análisis. `?aprobados=1` fuerza solo los aprobados (la bandeja del jefe de agencia). */
  @Get()
  listar(@OrgId() orgId: string, @Rol() rol: RolMiembro, @MembershipId() membershipId: string | null, @Query('aprobados') aprobados?: string) {
    return this.riesgos.listar(orgId, rol, membershipId, aprobados === '1');
  }

  /** Cuántos aprobados están pendientes de enviar por agencia (para el botón de envío). */
  @Get('pendientes-envio')
  pendientesDeEnvio(@OrgId() orgId: string) {
    return this.riesgos.pendientesDeEnvio(orgId);
  }

  /** Envío manual de lotes. Sin `sucursalId` manda todas las agencias con pendientes. */
  @Post('enviar')
  enviar(@OrgId() orgId: string, @Rol() rol: RolMiembro, @Body() body: unknown) {
    const { sucursalId } = z.object({ sucursalId: z.string().optional() }).parse(body ?? {});
    return this.riesgos.enviarLote(orgId, rol, sucursalId);
  }

  @Get(':leadId')
  obtener(@OrgId() orgId: string, @Rol() rol: RolMiembro, @MembershipId() membershipId: string | null, @Param('leadId') leadId: string) {
    return this.riesgos.obtener(orgId, leadId, rol, membershipId);
  }

  @Put(':leadId')
  guardar(@OrgId() orgId: string, @Rol() rol: RolMiembro, @MembershipId() membershipId: string | null, @Param('leadId') leadId: string, @Body() body: unknown) {
    return this.riesgos.guardar(orgId, leadId, rol, membershipId, analisisRiesgoInputSchema.parse(body));
  }
}
