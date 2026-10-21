import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { BotEngineModule } from '../bots/engine/bot-engine.module';
import { MensajesService } from './mensajes.service';
import { MensajesController } from './mensajes.controller';
import { MensajesWebhookController } from './mensajes-webhook.controller';
import { BotPollerService } from './bot-poller.service';

@Module({
  imports: [IntegracionesModule, NotificacionesModule, BotEngineModule],
  controllers: [MensajesController, MensajesWebhookController],
  providers: [PrismaService, MensajesService, BotPollerService],
  exports: [MensajesService],
})
export class MensajesModule {}
