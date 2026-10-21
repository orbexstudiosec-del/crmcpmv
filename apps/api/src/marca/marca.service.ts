import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MARCA_NOMBRE_DEFAULT, type Marca, type MarcaUpdateInput } from '@totalcrm/shared';

const ID = 'singleton';

/** Nombre con el que arranca la instalación mientras nadie lo haya editado en Configuración:
 * el que se eligió en el instalador (APP_NAME). */
export function nombreMarcaInicial(): string {
  return process.env.APP_NAME?.trim() || MARCA_NOMBRE_DEFAULT;
}

@Injectable()
export class MarcaService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<Marca> {
    const marca = await this.prisma.marca.findUnique({ where: { id: ID } });
    return {
      nombre: marca?.nombre ?? nombreMarcaInicial(),
      colorPrimario: marca?.colorPrimario ?? null,
      colorSecundario: marca?.colorSecundario ?? null,
      logo: marca?.logo ?? null,
      icono: marca?.icono ?? null,
    };
  }

  async nombre(): Promise<string> {
    return (await this.obtener()).nombre;
  }

  async actualizar(input: MarcaUpdateInput): Promise<Marca> {
    const marca = await this.prisma.marca.upsert({
      where: { id: ID },
      create: { id: ID, ...input, nombre: input.nombre ?? nombreMarcaInicial() },
      update: input,
    });
    return { nombre: marca.nombre, colorPrimario: marca.colorPrimario, colorSecundario: marca.colorSecundario, logo: marca.logo, icono: marca.icono };
  }
}
