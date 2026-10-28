import { Module } from '@nestjs/common';
import { CronopostController } from './cronopost.controller';
import { CronopostService } from './cronopost.service';
import { IaModule } from '../ia/ia.module';

@Module({
  imports: [IaModule],
  controllers: [CronopostController],
  providers: [CronopostService],
})
export class CronopostModule {}
