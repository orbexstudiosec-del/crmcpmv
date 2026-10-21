import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';

@Module({
  controllers: [NotificacionesController],
  providers: [PrismaService, NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
