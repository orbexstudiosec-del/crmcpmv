import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CampanasService } from './campanas.service';
import { campanaInputSchema, actualizarCampanaSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';

@Controller('campanas')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
export class CampanasController {
  constructor(private readonly campanas: CampanasService) {}

  @Get()
  listar(@OrgId() orgId: string) {
    return this.campanas.listar(orgId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  crear(@OrgId() orgId: string, @Body() body: unknown) {
    return this.campanas.crear(orgId, campanaInputSchema.parse(body));
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  actualizar(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.campanas.actualizar(orgId, id, actualizarCampanaSchema.parse(body));
  }

  @Post(':id/enviar')
  @Roles('OWNER', 'ADMIN')
  enviar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.campanas.enviar(orgId, id);
  }

  @Get(':id/destinatarios')
  listarDestinatarios(@OrgId() orgId: string, @Param('id') id: string) {
    return this.campanas.listarDestinatarios(orgId, id);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  eliminar(@OrgId() orgId: string, @Param('id') id: string) {
    return this.campanas.eliminar(orgId, id);
  }
}
