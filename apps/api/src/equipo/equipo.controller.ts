import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EquipoService } from './equipo.service';
import { miembroInputSchema, actualizarMiembroSchema, departamentoInputSchema, sucursalInputSchema, actualizarSucursalSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { Rol } from '../auth/decorators/rol.decorator';
import { MembershipId } from '../auth/decorators/membership-id.decorator';
import type { RolMiembro } from '@totalcrm/shared';

@Controller()
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
export class EquipoController {
  constructor(private readonly equipo: EquipoService) {}

  // ── Miembros ──────────────────────────────────────────────────
  @Get('equipo')
  listarMiembros(@OrgId() orgId: string) {
    return this.equipo.listarMiembros(orgId);
  }

  @Post('equipo')
  @Roles('OWNER', 'ADMIN')
  agregarMiembro(@OrgId() orgId: string, @Rol() rol: RolMiembro, @Body() body: unknown) {
    return this.equipo.agregarMiembro(orgId, miembroInputSchema.parse(body), rol);
  }

  @Patch('equipo/:id')
  @Roles('OWNER', 'ADMIN')
  actualizarMiembro(@OrgId() orgId: string, @Rol() rol: RolMiembro, @MembershipId() actorId: string | null, @Param('id') id: string, @Body() body: unknown) {
    return this.equipo.actualizarMiembro(orgId, id, actualizarMiembroSchema.parse(body), { rol, membershipId: actorId });
  }

  @Post('equipo/:id/reenviar-invitacion')
  @Roles('OWNER', 'ADMIN')
  reenviarInvitacion(@OrgId() orgId: string, @Param('id') id: string) {
    return this.equipo.reenviarInvitacion(orgId, id);
  }

  @Post('equipo/:id/restablecer-password')
  @Roles('OWNER', 'ADMIN')
  restablecerPassword(@OrgId() orgId: string, @Param('id') id: string) {
    return this.equipo.restablecerPassword(orgId, id);
  }

  @Delete('equipo/:id')
  @Roles('OWNER', 'ADMIN')
  eliminarMiembro(@OrgId() orgId: string, @Rol() rol: RolMiembro, @Param('id') id: string) {
    return this.equipo.eliminarMiembro(orgId, id, rol);
  }

  // ── Departamentos ────────────────────────────────────────────
  @Get('departamentos')
  listarDepartamentos(@OrgId() orgId: string) {
    return this.equipo.listarDepartamentos(orgId);
  }

  @Post('departamentos')
  @Roles('OWNER', 'ADMIN')
  crearDepartamento(@OrgId() orgId: string, @Body() body: unknown) {
    return this.equipo.crearDepartamento(orgId, departamentoInputSchema.parse(body));
  }

  @Delete('departamentos/:id')
  @Roles('OWNER', 'ADMIN')
  eliminarDepartamento(@OrgId() orgId: string, @Param('id') id: string) {
    return this.equipo.eliminarDepartamento(orgId, id);
  }

  // ── Sucursales ───────────────────────────────────────────────
  @Get('sucursales')
  listarSucursales(@OrgId() orgId: string) {
    return this.equipo.listarSucursales(orgId);
  }

  @Post('sucursales')
  @Roles('OWNER', 'ADMIN')
  crearSucursal(@OrgId() orgId: string, @Body() body: unknown) {
    return this.equipo.crearSucursal(orgId, sucursalInputSchema.parse(body));
  }

  @Patch('sucursales/:id')
  @Roles('OWNER', 'ADMIN')
  actualizarSucursal(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.equipo.actualizarSucursal(orgId, id, actualizarSucursalSchema.parse(body));
  }

  @Delete('sucursales/:id')
  @Roles('OWNER', 'ADMIN')
  eliminarSucursal(@OrgId() orgId: string, @Param('id') id: string) {
    return this.equipo.eliminarSucursal(orgId, id);
  }
}
