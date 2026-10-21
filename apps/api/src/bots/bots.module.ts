import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';

@Module({
  imports: [NotificacionesModule],
  controllers: [BotsController],
  providers: [PrismaService, BotsService],
})
export class BotsModule {}
