import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { OrganizacionService } from './organizacion.service';
import { organizacionUpdateSchema } from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';

@Controller('organizacion')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
export class OrganizacionController {
  constructor(private readonly organizacion: OrganizacionService) {}

  @Get()
  obtener(@OrgId() orgId: string) {
    return this.organizacion.obtener(orgId);
  }

  @Patch()
  @Roles('OWNER', 'ADMIN')
  actualizar(@OrgId() orgId: string, @Body() body: unknown) {
    return this.organizacion.actualizar(orgId, organizacionUpdateSchema.parse(body));
  }
}
