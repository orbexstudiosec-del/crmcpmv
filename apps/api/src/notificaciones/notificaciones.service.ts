import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { TipoNotificacion } from '@totalcrm/db';

const LIMITE_LISTA = 30;
const LIMITE_MAXIMO = 200;

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(organizationId: string, limite = LIMITE_LISTA) {
    const [items, noLeidas] = await Promise.all([
      this.prisma.notificacion.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limite, 1), LIMITE_MAXIMO),
      }),
      this.prisma.notificacion.count({ where: { organizationId, leida: false } }),
    ]);
    return { items, noLeidas };
  }

  async marcarLeida(organizationId: string, id: string) {
    await this.prisma.notificacion.updateMany({ where: { id, organizationId }, data: { leida: true } });
    return { ok: true };
  }

  async marcarTodasLeidas(organizationId: string) {
    await this.prisma.notificacion.updateMany({ where: { organizationId, leida: false }, data: { leida: true } });
    return { ok: true };
  }

  /** Helper que llaman otros servicios cuando ocurre un evento real (lead nuevo, mensaje
   *  entrante, etc.) — insert directo, sin cola ni cron. Nunca debe romper el flujo que la
   *  llama, así que absorbe cualquier error (una notificación fallida no es motivo para
   *  que falle la operación real, ej. crear un lead). */
  async crear(organizationId: string, tipo: TipoNotificacion, titulo: string, mensaje?: string, url?: string) {
    try {
      await this.prisma.notificacion.create({ data: { organizationId, tipo, titulo, mensaje, url } });
    } catch {
      // best-effort
    }
  }
}
