import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { RateLimitGuard } from './common/rate-limit.guard';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { EquipoModule } from './equipo/equipo.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { FormulariosLeadModule } from './formularios-lead/formularios-lead.module';
import { CampanasModule } from './campanas/campanas.module';
import { OrganizacionModule } from './organizacion/organizacion.module';
import { IntegracionesModule } from './integraciones/integraciones.module';
import { MensajesModule } from './mensajes/mensajes.module';
import { BotsModule } from './bots/bots.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { MarcaModule } from './marca/marca.module';
import { RiesgosModule } from './riesgos/riesgos.module';
import { InstalacionService } from './instalacion/instalacion.service';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, CrmModule, EquipoModule, PipelineModule, FormulariosLeadModule, CampanasModule, OrganizacionModule, IntegracionesModule, MensajesModule, BotsModule, NotificacionesModule, MarcaModule, RiesgosModule],
  controllers: [HealthController],
  providers: [PrismaService, InstalacionService, RateLimitGuard],
  exports: [PrismaService],
})
export class AppModule {}
