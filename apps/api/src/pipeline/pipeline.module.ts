import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [NotificacionesModule],
  controllers: [PipelineController],
  providers: [PrismaService, PipelineService],
})
export class PipelineModule {}
