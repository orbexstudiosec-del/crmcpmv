import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { botFlowInputSchema, actualizarBotFlowSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('bots')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
// Los bots responden solos a los clientes y descargan archivos de URLs: solo los gestionan la
// administración y los jefes de agencia (la web tampoco le muestra Bots a los demás roles).
@Roles('OWNER', 'ADMIN', 'SUPERVISOR')
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Get()
  listar(@OrgId() orgId: string) {
    return this.bots.listar(orgId);
  }

  // Debe ir antes de ':id' — si no, "/bots/templates" haría match con ':id' y nunca llegaría acá.
  @Get('templates')
  listarPlantillas() {
    return this.bots.listarPlantillas();
  }

  @Get(':id')
  obtener(@OrgId() orgId: string, @Param('id') id: string) {
    return this.bots.obtener(orgId, id);
  }

  @Post()
  crear(@OrgId() orgId: string, @Body() body: unknown) {
    return this.bots.crear(orgId, botFlowInputSchema.parse(body));
  }

  @Patch(':id')
  actualizar(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.bots.actualizar(orgId, id, actualizarBotFlowSchema.parse(body));
  }

  @Delete(':id')
  eliminar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.bots.eliminar(orgId, id);
  }

  @Post(':id/activar')
  activar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.bots.activar(orgId, id);
  }

  @Post(':id/desactivar')
  desactivar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.bots.desactivar(orgId, id);
  }
}
