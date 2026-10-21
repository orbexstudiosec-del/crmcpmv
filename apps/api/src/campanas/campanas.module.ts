import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MensajesModule } from '../mensajes/mensajes.module';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { CampanasService } from './campanas.service';
import { CampanasController } from './campanas.controller';

@Module({
  imports: [MensajesModule, IntegracionesModule],
  controllers: [CampanasController],
  providers: [PrismaService, CampanasService],
})
export class CampanasModule {}
