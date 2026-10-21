import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EquipoService } from './equipo.service';
import { EquipoController } from './equipo.controller';

@Module({
  controllers: [EquipoController],
  providers: [PrismaService, EquipoService],
})
export class EquipoModule {}
