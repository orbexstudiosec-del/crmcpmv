import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { marcaUpdateSchema } from '@totalcrm/shared';
import { MarcaService } from './marca.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('marca')
export class MarcaController {
  constructor(private readonly marca: MarcaService) {}

  /** Público a propósito: la pantalla de login necesita el nombre y el logo antes de que
   * exista una sesión. No expone nada más que eso. */
  @Get()
  obtener() {
    return this.marca.obtener();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  actualizar(@Body() body: unknown) {
    return this.marca.actualizar(marcaUpdateSchema.parse(body));
  }
}
