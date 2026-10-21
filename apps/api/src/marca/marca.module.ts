import { Global, Module } from '@nestjs/common';
import { MarcaController } from './marca.controller';
import { MarcaService } from './marca.service';

/** Global: el correo (auth) y los bots también necesitan el nombre de la marca. */
@Global()
@Module({
  controllers: [MarcaController],
  providers: [MarcaService],
  exports: [MarcaService],
})
export class MarcaModule {}
