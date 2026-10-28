import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { configuracionIaSchema } from '@totalcrm/shared';
import { IaService } from './ia.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

@Controller('ia')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
export class IaController {
  constructor(private readonly ia: IaService) {}

  /** Si la IA está configurada y con qué modelo (la clave solo enmascarada). Lo consultan también
   *  quienes usan el Cronopost, para avisar si falta configurarla. */
  @Get('configuracion')
  @Roles('OWNER', 'ADMIN', 'SUPERVISOR', 'GERENCIA')
  estado(@OrgId() orgId: string) {
    return this.ia.estado(orgId);
  }

  /** Cada guardado y cada prueba hacen una llamada (pequeña) a OpenAI: límite por IP. */
  @Put('configuracion')
  @Roles('OWNER', 'ADMIN')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, ventanaMs: 60_000 })
  guardar(@OrgId() orgId: string, @Body() body: unknown) {
    return this.ia.guardar(orgId, configuracionIaSchema.parse(body));
  }

  @Delete('configuracion')
  @Roles('OWNER', 'ADMIN')
  eliminar(@OrgId() orgId: string) {
    return this.ia.eliminar(orgId);
  }

  @Post('probar')
  @Roles('OWNER', 'ADMIN')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, ventanaMs: 60_000 })
  probar(@OrgId() orgId: string) {
    return this.ia.probar(orgId);
  }
}
