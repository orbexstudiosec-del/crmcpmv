import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';

@Module({
  controllers: [CrmController],
  providers: [PrismaService, CrmService],
})
export class CrmModule {}
