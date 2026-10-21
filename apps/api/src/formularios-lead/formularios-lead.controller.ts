import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { FormulariosLeadService } from './formularios-lead.service';
import { formularioLeadInputSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RolMiembro } from '@totalcrm/shared';

/** Quién arma formularios y ve sus respuestas (también los usa Campañas): la administración y
 *  los jefes de agencia. Va por endpoint y no en la clase porque las rutas públicas no llevan guards. */
const GESTORES: RolMiembro[] = ['OWNER', 'ADMIN', 'SUPERVISOR'];

@Controller('formularios-lead')
export class FormulariosLeadController {
  constructor(private readonly service: FormulariosLeadService) {}

  // ── Autenticado (builder/admin) ──────────────────────────────────

  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles(...GESTORES)
  @Get()
  listar(@OrgId() orgId: string) {
    return this.service.listar(orgId);
  }

  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles(...GESTORES)
  @Get(':id')
  obtener(@OrgId() orgId: string, @Param('id') id: string) {
    return this.service.obtener(orgId, id);
  }

  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles(...GESTORES)
  @Post()
  crear(@OrgId() orgId: string, @Body() body: unknown) {
    return this.service.crear(orgId, formularioLeadInputSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles(...GESTORES)
  @Patch(':id')
  actualizar(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.service.actualizar(orgId, id, formularioLeadInputSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles(...GESTORES)
  @Delete(':id')
  eliminar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.service.eliminar(orgId, id);
  }

  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles(...GESTORES)
  @Get(':id/leads')
  leadsDelFormulario(@OrgId() orgId: string, @Param('id') id: string) {
    return this.service.leadsDelFormulario(orgId, id);
  }

  // ── Público (sin guards — formulario embebido/link/QR) ───────────

  @Get('publico/:slug')
  obtenerPublico(@Param('slug') slug: string) {
    return this.service.obtenerPublico(slug);
  }

  @Post('publico/:slug')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 8, ventanaMs: 60_000 }) // 8 envíos por IP por minuto: frena el spam de bots
  enviarPublico(@Param('slug') slug: string, @Body() body: unknown) {
    return this.service.enviarPublico(slug, body);
  }
}
