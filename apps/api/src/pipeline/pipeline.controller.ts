import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import {
  leadInputSchema, actualizarLeadSchema, convertirLeadSchema,
  oportunidadInputSchema, actualizarOportunidadSchema,
  actividadInputSchema, actualizarActividadSchema,
} from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { MembershipId } from '../auth/decorators/membership-id.decorator';

@Controller()
@UseGuards(JwtAuthGuard, TenancyGuard)
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  // ── Leads ────────────────────────────────────────────────────
  @Get('leads')
  listarLeads(@OrgId() orgId: string, @MembershipId() membershipId: string | null) {
    return this.pipeline.listarLeads(orgId, membershipId);
  }

  /** Ciudades que cubre alguna agencia — para sugerirlas al registrar un prospecto. */
  @Get('leads/ciudades')
  ciudadesConAgencia(@OrgId() orgId: string) {
    return this.pipeline.ciudadesConAgencia(orgId);
  }

  @Post('leads')
  crearLead(@OrgId() orgId: string, @Body() body: unknown) {
    return this.pipeline.crearLead(orgId, leadInputSchema.parse(body));
  }

  @Patch('leads/:id')
  actualizarLead(@OrgId() orgId: string, @MembershipId() membershipId: string | null, @Param('id') id: string, @Body() body: unknown) {
    return this.pipeline.actualizarLead(orgId, id, actualizarLeadSchema.parse(body), membershipId);
  }

  @Delete('leads/:id')
  eliminarLead(@OrgId() orgId: string, @MembershipId() membershipId: string | null, @Param('id') id: string) {
    return this.pipeline.eliminarLead(orgId, id, membershipId);
  }

  @Post('leads/:id/convertir')
  convertirLead(@OrgId() orgId: string, @MembershipId() membershipId: string | null, @Param('id') id: string, @Body() body: unknown) {
    return this.pipeline.convertirLead(orgId, id, convertirLeadSchema.parse(body ?? {}), membershipId);
  }

  // ── Oportunidades ────────────────────────────────────────────
  @Get('oportunidades')
  listarOportunidades(@OrgId() orgId: string) {
    return this.pipeline.listarOportunidades(orgId);
  }

  @Post('oportunidades')
  crearOportunidad(@OrgId() orgId: string, @Body() body: unknown) {
    return this.pipeline.crearOportunidad(orgId, oportunidadInputSchema.parse(body));
  }

  @Patch('oportunidades/:id')
  actualizarOportunidad(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.pipeline.actualizarOportunidad(orgId, id, actualizarOportunidadSchema.parse(body));
  }

  @Delete('oportunidades/:id')
  eliminarOportunidad(@OrgId() orgId: string, @Param('id') id: string) {
    return this.pipeline.eliminarOportunidad(orgId, id);
  }

  // ── Actividades ──────────────────────────────────────────────
  @Get('actividades')
  listarActividades(
    @OrgId() orgId: string,
    @Query('leadId') leadId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('oportunidadId') oportunidadId?: string,
    @Query('conversacionId') conversacionId?: string,
    @Query('pendientes') pendientes?: string,
  ) {
    return this.pipeline.listarActividades(orgId, { leadId, clienteId, oportunidadId, conversacionId, pendientes: pendientes === 'true' });
  }

  @Post('actividades')
  crearActividad(@OrgId() orgId: string, @MembershipId() membershipId: string | null, @Body() body: unknown) {
    return this.pipeline.crearActividad(orgId, actividadInputSchema.parse(body), membershipId);
  }

  @Patch('actividades/:id')
  actualizarActividad(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.pipeline.actualizarActividad(orgId, id, actualizarActividadSchema.parse(body));
  }

  @Delete('actividades/:id')
  eliminarActividad(@OrgId() orgId: string, @Param('id') id: string) {
    return this.pipeline.eliminarActividad(orgId, id);
  }
}
