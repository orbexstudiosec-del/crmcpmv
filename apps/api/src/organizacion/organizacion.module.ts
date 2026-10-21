import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionService } from './organizacion.service';
import { OrganizacionController } from './organizacion.controller';

@Module({
  controllers: [OrganizacionController],
  providers: [PrismaService, OrganizacionService],
})
export class OrganizacionModule {}
