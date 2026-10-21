import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BotFlowInput, ActualizarBotFlowInput, FlowDefinition } from '@totalcrm/shared';
import { FLOW_VACIO } from '@totalcrm/shared';
import { PLANTILLAS_BOT, obtenerPlantilla } from './bots.templates';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  listarPlantillas() {
    return PLANTILLAS_BOT.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      etiqueta: p.etiqueta,
      nombreSugerido: p.nombreSugerido,
      descripcionSugerida: p.descripcionSugerida,
      nodos: p.definicion.nodes.length,
      conexiones: p.definicion.edges.length,
    }));
  }

  /** Sin ids de nodo repetidos, exactamente un disparador, y cada conexión apunta a nodos que existen. */
  private validarGrafo(definicion: FlowDefinition) {
    const ids = new Set<string>();
    for (const n of definicion.nodes) {
      if (ids.has(n.id)) throw new BadRequestException(`Hay un id de nodo repetido: ${n.id}`);
      ids.add(n.id);
    }
    const disparadores = definicion.nodes.filter((n) => n.type === 'trigger').length;
    if (disparadores !== 1) {
      throw new BadRequestException('El flujo debe tener exactamente un nodo de inicio');
    }
    for (const e of definicion.edges) {
      if (!ids.has(e.source) || !ids.has(e.target)) {
        throw new BadRequestException(`La conexión "${e.id}" apunta a un nodo que no existe`);
      }
    }
  }

  listar(organizationId: string) {
    return this.prisma.botFlow.findMany({
      where: { organizationId },
      orderBy: [{ activo: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async obtener(organizationId: string, id: string) {
    const bot = await this.prisma.botFlow.findFirst({ where: { id, organizationId } });
    if (!bot) throw new BadRequestException('El bot no existe en esta organización');
    return bot;
  }

  crear(organizationId: string, input: BotFlowInput) {
    const definicion = input.plantilla ? (obtenerPlantilla(input.plantilla)?.definicion ?? FLOW_VACIO) : FLOW_VACIO;
    return this.prisma.botFlow.create({
      data: {
        organizationId,
        nombre: input.nombre,
        descripcion: input.descripcion ?? '',
        canal: input.canal,
        definicion,
      },
    });
  }

  async actualizar(organizationId: string, id: string, input: ActualizarBotFlowInput) {
    const bot = await this.prisma.botFlow.findFirst({ where: { id, organizationId } });
    if (!bot) throw new BadRequestException('El bot no existe en esta organización');
    if (input.definicion) this.validarGrafo(input.definicion);

    return this.prisma.botFlow.update({
      where: { id },
      data: {
        ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion } : {}),
        ...(input.canal !== undefined ? { canal: input.canal } : {}),
        ...(input.definicion !== undefined ? { definicion: input.definicion } : {}),
      },
    });
  }

  async eliminar(organizationId: string, id: string) {
    const bot = await this.prisma.botFlow.findFirst({ where: { id, organizationId } });
    if (!bot) throw new BadRequestException('El bot no existe en esta organización');
    await this.prisma.botFlow.delete({ where: { id } });
    return { ok: true };
  }

  async activar(organizationId: string, id: string) {
    const bot = await this.prisma.botFlow.findFirst({ where: { id, organizationId } });
    if (!bot) throw new BadRequestException('El bot no existe en esta organización');
    this.validarGrafo(bot.definicion as unknown as FlowDefinition);

    await this.prisma.$transaction([
      this.prisma.botFlow.updateMany({ where: { organizationId, activo: true }, data: { activo: false } }),
      this.prisma.botFlow.update({ where: { id }, data: { activo: true } }),
    ]);
    void this.notificaciones.crear(organizationId, 'BOT_ACTIVADO', `Se activó el bot "${bot.nombre}"`, undefined, `/bots/${id}`);
    return { ok: true };
  }

  async desactivar(organizationId: string, id: string) {
    const bot = await this.prisma.botFlow.findFirst({ where: { id, organizationId } });
    if (!bot) throw new BadRequestException('El bot no existe en esta organización');
    await this.prisma.botFlow.update({ where: { id }, data: { activo: false } });
    return { ok: true };
  }
}
