import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IntegracionesService } from './integraciones.service';
import { conectarIntegracionSchema, canalMensajeriaSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';

@Controller('integraciones')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
export class IntegracionesController {
  constructor(private readonly integraciones: IntegracionesService) {}

  @Get()
  listar(@OrgId() orgId: string) {
    return this.integraciones.listar(orgId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  conectar(@OrgId() orgId: string, @Body() body: unknown, @Req() req: Request) {
    const origen = `${req.protocol}://${req.get('host')}`;
    return this.integraciones.conectar(orgId, conectarIntegracionSchema.parse(body), origen);
  }

  @Delete(':canal')
  @Roles('OWNER', 'ADMIN')
  desconectar(@OrgId() orgId: string, @Param('canal') canal: string) {
    return this.integraciones.desconectar(orgId, canalMensajeriaSchema.parse(canal));
  }
}
