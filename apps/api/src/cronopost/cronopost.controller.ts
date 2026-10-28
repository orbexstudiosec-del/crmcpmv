import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CronopostService } from './cronopost.service';
import {
  publicacionInputSchema, actualizarPublicacionSchema, listarPublicacionesSchema, generarCopySchema,
  cronopostConfigSchema, generarPlanSchema, lotePublicacionesSchema, categoriaCronopostSchema, actualizarCategoriaCronopostSchema,
} from '@totalcrm/shared';
import type { RolMiembro } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

/** Quién arma el cronopost: la administración y los jefes de agencia (igual que Campañas). */
const EDITORES: RolMiembro[] = ['OWNER', 'ADMIN', 'SUPERVISOR'];

@Controller('cronopost')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
// GERENCIA lo consulta en solo lectura (TenancyGuard le bloquea cualquier escritura).
@Roles(...EDITORES, 'GERENCIA')
export class CronopostController {
  constructor(private readonly cronopost: CronopostService) {}

  /** `?desde=&hasta=` (ISO) para traer solo el rango que se está mirando (ej. un mes). */
  @Get()
  listar(@OrgId() orgId: string, @Query() query: unknown) {
    const { desde, hasta } = listarPublicacionesSchema.parse(query);
    return this.cronopost.listar(orgId, desde, hasta);
  }

  @Post()
  @Roles(...EDITORES)
  crear(@OrgId() orgId: string, @Body() body: unknown) {
    return this.cronopost.crear(orgId, publicacionInputSchema.parse(body));
  }

  /** Las propuestas del plan generado con IA que el equipo decidió agregar. */
  @Post('lote')
  @Roles(...EDITORES)
  crearLote(@OrgId() orgId: string, @Body() body: unknown) {
    return this.cronopost.crearLote(orgId, lotePublicacionesSchema.parse(body).publicaciones);
  }

  // Rutas fijas antes de ':id' para que no las capture el parámetro.
  @Get('configuracion')
  obtenerConfig(@OrgId() orgId: string) {
    return this.cronopost.obtenerConfig(orgId);
  }

  @Put('configuracion')
  @Roles(...EDITORES)
  guardarConfig(@OrgId() orgId: string, @Body() body: unknown) {
    return this.cronopost.guardarConfig(orgId, cronopostConfigSchema.parse(body));
  }

  @Get('categorias')
  listarCategorias(@OrgId() orgId: string) {
    return this.cronopost.listarCategorias(orgId);
  }

  @Post('categorias')
  @Roles(...EDITORES)
  crearCategoria(@OrgId() orgId: string, @Body() body: unknown) {
    return this.cronopost.crearCategoria(orgId, categoriaCronopostSchema.parse(body));
  }

  @Patch('categorias/:id')
  @Roles(...EDITORES)
  actualizarCategoria(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.cronopost.actualizarCategoria(orgId, id, actualizarCategoriaCronopostSchema.parse(body));
  }

  @Delete('categorias/:id')
  @Roles(...EDITORES)
  eliminarCategoria(@OrgId() orgId: string, @Param('id') id: string) {
    return this.cronopost.eliminarCategoria(orgId, id);
  }

  /** Cada llamada cuesta dinero en el proveedor de IA: límite por IP. */
  @Post('generar-copy')
  @Roles(...EDITORES)
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 20, ventanaMs: 60_000 })
  generarCopy(@OrgId() orgId: string, @Body() body: unknown) {
    return this.cronopost.generarCopy(orgId, generarCopySchema.parse(body));
  }

  /** Plan completo de una semana o un mes (no guarda nada: devuelve propuestas). */
  @Post('generar-plan')
  @Roles(...EDITORES)
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 6, ventanaMs: 60_000 })
  generarPlan(@OrgId() orgId: string, @Body() body: unknown) {
    return this.cronopost.generarPlan(orgId, generarPlanSchema.parse(body));
  }

  @Patch(':id')
  @Roles(...EDITORES)
  actualizar(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.cronopost.actualizar(orgId, id, actualizarPublicacionSchema.parse(body));
  }

  @Delete(':id')
  @Roles(...EDITORES)
  eliminar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.cronopost.eliminar(orgId, id);
  }
}
