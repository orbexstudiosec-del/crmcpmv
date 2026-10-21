import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FormulariosLeadService } from './formularios-lead.service';
import { FormulariosLeadController } from './formularios-lead.controller';

@Module({
  imports: [NotificacionesModule],
  controllers: [FormulariosLeadController],
  providers: [PrismaService, FormulariosLeadService],
  exports: [FormulariosLeadService],
})
export class FormulariosLeadModule {}
