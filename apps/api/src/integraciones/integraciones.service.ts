import { Injectable } from '@nestjs/common';
import { cifrarTexto, descifrarTexto } from '../common/cifrado';
import { PrismaService } from '../prisma/prisma.service';
import type { ConectarIntegracionInput, CanalMensajeria, EstadoIntegracion } from '@totalcrm/shared';
import { verificarWhatsappApi, verificarMessenger, verificarInstagram, verificarTiktok } from './verificadores';
import { suscribirWebhookMeta } from './meta-client';
import { urlWebhookMeta } from '../common/webhook-url';

const CANALES: CanalMensajeria[] = ['WHATSAPP_API', 'MESSENGER', 'INSTAGRAM', 'TIKTOK'];

const SELECT = {
  canal: true,
  estado: true,
  etiqueta: true,
  conectadoEn: true,
  updatedAt: true,
};

@Injectable()
export class IntegracionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve el estado de cada canal (conectado o no) — nunca las credenciales. */
  async listar(organizationId: string) {
    const guardadas = await this.prisma.integracionCanal.findMany({
      where: { organizationId },
      select: SELECT,
    });
    const porCanal = new Map(guardadas.map((g) => [g.canal, g]));
    return CANALES.map((canal) => porCanal.get(canal) ?? { canal, estado: 'DESCONECTADO' as const, etiqueta: null, conectadoEn: null, updatedAt: null });
  }

  async conectar(organizationId: string, input: ConectarIntegracionInput, origen: string) {
    let etiqueta: string;
    try {
      etiqueta = await this.verificar(input);
    } catch (err) {
      await this.marcarError(organizationId, input.canal);
      throw err;
    }
    const guardado = await this.guardar(organizationId, input.canal, input.credenciales, 'CONECTADO', etiqueta);

    if (input.canal === 'WHATSAPP_API') {
      // Meta no deja registrar el callback URL por API — eso lo pega el usuario a mano en su
      // app. Esto solo cubre la otra mitad automatizable: que la WABA quede suscrita a los
      // eventos de esa app (sin esto, aunque el callback esté bien puesto, Meta nunca manda
      // nada de esta cuenta puntual). Best-effort, no bloquea.
      const webhookAdvertencia = await suscribirWebhookMeta(input.credenciales);
      return { ...guardado, webhookUrl: urlWebhookMeta(organizationId, origen), webhookAdvertencia };
    }

    return guardado;
  }

  async desconectar(organizationId: string, canal: CanalMensajeria) {
    await this.prisma.integracionCanal.deleteMany({ where: { organizationId, canal } });
    return { ok: true };
  }

  /** Solo para uso interno (envío y recepción de mensajes, campañas, bots). */
  async credencialesDescifradas(organizationId: string, canal: CanalMensajeria) {
    const registro = await this.prisma.integracionCanal.findUnique({
      where: { organizationId_canal: { organizationId, canal } },
    });
    if (!registro?.configCifrada || !registro.configIv || !registro.configTag) return null;
    const json = descifrarTexto({
      data: Buffer.from(registro.configCifrada),
      iv: Buffer.from(registro.configIv),
      tag: Buffer.from(registro.configTag),
    });
    return JSON.parse(json) as unknown;
  }

  private async marcarError(organizationId: string, canal: CanalMensajeria) {
    // Guardamos el intento fallido como ERROR para que la UI lo muestre, pero sin credenciales
    // (si ya había una conexión previa con credenciales válidas, esas se conservan).
    await this.prisma.integracionCanal.upsert({
      where: { organizationId_canal: { organizationId, canal } },
      create: { organizationId, canal, estado: 'ERROR' },
      update: { estado: 'ERROR' },
    });
  }

  private async guardar(organizationId: string, canal: CanalMensajeria, credenciales: unknown, estado: EstadoIntegracion, etiqueta: string) {
    const cifrado = cifrarTexto(JSON.stringify(credenciales));
    // Prisma tipa los campos Bytes como Uint8Array<ArrayBuffer>; Buffer no es estructuralmente
    // idéntico (su .buffer es ArrayBufferLike), así que se envuelve explícito.
    const data = new Uint8Array(cifrado.data);
    const iv = new Uint8Array(cifrado.iv);
    const tag = new Uint8Array(cifrado.tag);
    const conectadoEn = estado === 'CONECTADO' ? new Date() : null;

    return this.prisma.integracionCanal.upsert({
      where: { organizationId_canal: { organizationId, canal } },
      create: { organizationId, canal, estado, etiqueta, configCifrada: data, configIv: iv, configTag: tag, conectadoEn },
      update: { estado, etiqueta, configCifrada: data, configIv: iv, configTag: tag, conectadoEn },
      select: SELECT,
    });
  }

  private verificar(input: ConectarIntegracionInput): Promise<string> {
    switch (input.canal) {
      case 'WHATSAPP_API': return verificarWhatsappApi(input.credenciales);
      case 'MESSENGER': return verificarMessenger(input.credenciales);
      case 'INSTAGRAM': return verificarInstagram(input.credenciales);
      case 'TIKTOK': return verificarTiktok(input.credenciales);
    }
  }
}
