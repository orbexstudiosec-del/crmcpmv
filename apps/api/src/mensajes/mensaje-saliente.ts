import type { PrismaService } from '../prisma/prisma.service';
import type { TipoMensaje } from '@totalcrm/shared';

/** Persiste un mensaje SALIENTE y actualiza `ultimoMensajeEn` de la conversación — usado
 * tanto por los envíos manuales de un humano desde el inbox (`MensajesService`) como por el
 * motor de bots (`BotEngineService`). Vive fuera de ambos servicios (función simple, sin DI)
 * para que ninguno de los dos módulos tenga que importar al otro: Mensajes dispara al motor
 * cuando llega un mensaje entrante, el motor envía sin depender de MensajesModule.
 *
 * `pausarBot: true` marca la conversación como "tomada por un humano" — el motor de bots deja
 * de intervenir en ella hasta que se reactive a mano. Los envíos del propio motor NO deben
 * pasar `pausarBot` (obviamente no se pausan a sí mismos). */
export async function guardarMensajeSaliente(
  prisma: PrismaService,
  params: { conversacionId: string; tipo: TipoMensaje; contenido: string; remoteId?: string; pausarBot?: boolean },
) {
  const enviadoEn = new Date();
  const mensaje = await prisma.mensaje.create({
    data: {
      conversacionId: params.conversacionId, direccion: 'SALIENTE',
      tipo: params.tipo, contenido: params.contenido, remoteId: params.remoteId, enviadoEn,
    },
  });
  await prisma.conversacion.update({
    where: { id: params.conversacionId },
    data: { ultimoMensajeEn: enviadoEn, ...(params.pausarBot ? { botPausado: true } : {}) },
  });
  return mensaje;
}
