import { Module } from '@nestjs/common';
import { RiesgosController } from './riesgos.controller';
import { RiesgosService } from './riesgos.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [NotificacionesModule],
  controllers: [RiesgosController],
  providers: [RiesgosService],
})
export class RiesgosModule {}
