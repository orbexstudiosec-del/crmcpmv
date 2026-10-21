import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { clienteInputSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { OrgId } from '../auth/decorators/org-id.decorator';

@Controller()
@UseGuards(JwtAuthGuard, TenancyGuard)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('clientes')
  listarClientes(@OrgId() orgId: string) {
    return this.crm.listarClientes(orgId);
  }

  @Post('clientes')
  crearCliente(@OrgId() orgId: string, @Body() body: unknown) {
    return this.crm.crearCliente(orgId, clienteInputSchema.parse(body));
  }
}
