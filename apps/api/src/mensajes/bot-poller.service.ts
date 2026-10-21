import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MensajesService } from './mensajes.service';

const INTERVALO_MS = 15_000;

/** Sin esto, el motor de bots solo reaccionaría a mensajes nuevos cuando alguien tenga el
 * inbox abierto en el navegador (la sincronización hoy la dispara el frontend cada 15s) o
 * cuando Evolution logre pegarle al webhook real (requiere URL pública, no hay en desarrollo
 * local). Este poller hace lo mismo desde el servidor, sin depender de ninguno de los dos.
 * Deliberadamente simple — un `setInterval` de un servicio Nest, sin colas ni librerías
 * nuevas — es la mínima pieza de infraestructura necesaria para que el bot funcione solo. */
@Injectable()
export class BotPollerService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mensajes: MensajesService,
  ) {}

  onModuleInit() {
    setInterval(() => { void this.revisar(); }, INTERVALO_MS);
  }

  private async revisar(): Promise<void> {
    try {
      const orgsConBot = await this.prisma.botFlow.findMany({
        where: { activo: true },
        select: { organizationId: true },
        distinct: ['organizationId'],
      });
      for (const { organizationId } of orgsConBot) {
        const integracion = await this.prisma.integracionCanal.findUnique({
          where: { organizationId_canal: { organizationId, canal: 'WHATSAPP_QR' } },
        });
        if (integracion?.estado === 'CONECTADO') {
          await this.mensajes.sincronizarWhatsappQr(organizationId).catch(() => {});
        }
      }
    } catch {
      // el poller nunca debe tumbar el proceso; se reintenta en la siguiente vuelta
    }
  }
}
