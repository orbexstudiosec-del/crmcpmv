import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracionesModule } from '../../integraciones/integraciones.module';
import { NotificacionesModule } from '../../notificaciones/notificaciones.module';
import { BotEngineService } from './bot-engine.service';

@Module({
  imports: [IntegracionesModule, NotificacionesModule],
  providers: [PrismaService, BotEngineService],
  exports: [BotEngineService],
})
export class BotEngineModule {}
