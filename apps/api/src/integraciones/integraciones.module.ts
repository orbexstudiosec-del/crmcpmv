import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegracionesService } from './integraciones.service';
import { IntegracionesController } from './integraciones.controller';

@Module({
  controllers: [IntegracionesController],
  providers: [PrismaService, IntegracionesService],
  exports: [IntegracionesService],
})
export class IntegracionesModule {}
