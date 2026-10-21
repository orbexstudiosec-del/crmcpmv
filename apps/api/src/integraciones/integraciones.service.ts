import { BadRequestException, Injectable } from '@nestjs/common';
import { cifrarTexto, descifrarTexto } from '../common/cifrado';
import { PrismaService } from '../prisma/prisma.service';
import type { ConectarIntegracionInput, CanalMensajeria, CredencialesWhatsappQr, CredencialesWhatsappQrResueltas, EstadoIntegracion } from '@totalcrm/shared';
import {
  conectarWhatsappQr, reconsultarWhatsappQr,
  verificarWhatsappApi, verificarMessenger, verificarInstagram, verificarTiktok,
} from './verificadores';
import { configurarWebhookEvolution } from './evolution-webhook';
import { suscribirWebhookMeta } from './meta-client';
import { urlWebhookEvolution, urlWebhookMeta } from '../common/webhook-url';
import { validarUrlExterna } from '../common/ssrf';

const CANALES: CanalMensajeria[] = ['WHATSAPP_QR', 'WHATSAPP_API', 'MESSENGER', 'INSTAGRAM', 'TIKTOK'];

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

  /** Devuelve el estado de los 5 canales (conectados o no) — nunca las credenciales. */
  async listar(organizationId: string) {
    const guardadas = await this.prisma.integracionCanal.findMany({
      where: { organizationId },
      select: SELECT,
    });
    const porCanal = new Map(guardadas.map((g) => [g.canal, g]));
    return CANALES.map((canal) => porCanal.get(canal) ?? { canal, estado: 'DESCONECTADO' as const, etiqueta: null, conectadoEn: null, updatedAt: null });
  }

  async conectar(organizationId: string, input: ConectarIntegracionInput, origen: string) {
    if (input.canal === 'WHATSAPP_QR') {
      const credenciales = this.resolverCredencialesWhatsappQr(organizationId, input.credenciales);
      // Evita que una URL escrita por el usuario apunte a la red interna o a la metadata de la
      // nube (SSRF). La del propio servidor (EVOLUTION_API_URL) no se valida: en Docker es
      // http://evolution:8080, una IP privada a propósito, y bloquearla rompía WhatsApp QR.
      if (credenciales.evolutionApiUrl !== process.env.EVOLUTION_API_URL) {
        credenciales.evolutionApiUrl = await validarUrlExterna(credenciales.evolutionApiUrl);
      }
      let resultado: Awaited<ReturnType<typeof conectarWhatsappQr>>;
      try {
        resultado = await conectarWhatsappQr(credenciales);
      } catch (err) {
        await this.marcarError(organizationId, input.canal);
        throw err;
      }
      // Registramos el webhook automáticamente contra Evolution API — así la recepción de
      // mensajes queda configurada sola, sin que el usuario tenga que pegar nada a mano.
      // EVOLUTION_WEBHOOK_BASE: cuando Evolution corre en la misma red Docker que el API, le
      // conviene llamar al API por su nombre de servicio en vez de salir y volver a entrar por
      // el dominio público (y así WhatsApp QR funciona incluso sin dominio).
      const baseWebhook = process.env.EVOLUTION_WEBHOOK_BASE?.replace(/\/+$/, '') || origen;
      const webhookAdvertencia = await configurarWebhookEvolution(credenciales, urlWebhookEvolution(organizationId, baseWebhook));
      const guardado = await this.guardar(organizationId, input.canal, credenciales, resultado.estado, resultado.etiqueta);
      return { ...guardado, qrCode: resultado.qrCode, webhookAdvertencia };
    }

    let etiqueta: string;
    try {
      etiqueta = await this.verificar(input);
    } catch (err) {
      await this.marcarError(organizationId, input.canal);
      throw err;
    }
    const guardado = await this.guardar(organizationId, input.canal, input.credenciales, 'CONECTADO', etiqueta);

    if (input.canal === 'WHATSAPP_API') {
      // A diferencia de Evolution, Meta no deja registrar el callback URL por API — eso lo
      // pega el usuario a mano en su app. Esto solo cubre la otra mitad automatizable: que
      // la WABA quede suscrita a los eventos de esa app (sin esto, aunque el callback esté
      // bien puesto, Meta nunca manda nada de esta cuenta puntual). Best-effort, no bloquea.
      const webhookAdvertencia = await suscribirWebhookMeta(input.credenciales);
      return { ...guardado, webhookUrl: urlWebhookMeta(organizationId, origen), webhookAdvertencia };
    }

    return guardado;
  }

  /** Polling desde el frontend mientras se muestra el QR: vuelve a preguntarle a Evolution
   * API si ya se emparejó, usando las credenciales ya guardadas (cifradas) de esta org. */
  async estadoWhatsappQr(organizationId: string) {
    const credenciales = await this.credencialesDescifradas(organizationId, 'WHATSAPP_QR') as CredencialesWhatsappQrResueltas | null;
    if (!credenciales) throw new BadRequestException('No hay una conexión de WhatsApp (QR) iniciada.');

    const resultado = await reconsultarWhatsappQr(credenciales);
    return this.guardar(organizationId, 'WHATSAPP_QR', credenciales, resultado.estado, resultado.etiqueta, { mantenerConectadoEn: true });
  }

  async desconectar(organizationId: string, canal: CanalMensajeria) {
    await this.prisma.integracionCanal.deleteMany({ where: { organizationId, canal } });
    return { ok: true };
  }

  /** Solo para uso interno (ej. el futuro módulo de Mensajes enviando/recibiendo). */
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

  /** Completa lo que falte con EVOLUTION_API_URL/EVOLUTION_API_KEY del servidor (nunca se
   * exponen al navegador) y, si falta el nombre de instancia, deriva uno único por org. */
  private resolverCredencialesWhatsappQr(organizationId: string, input: CredencialesWhatsappQr): CredencialesWhatsappQrResueltas {
    const evolutionApiUrl = input.evolutionApiUrl || process.env.EVOLUTION_API_URL;
    // La API key global del servidor solo se usa contra el Evolution del propio servidor: si se
    // completara también para una URL externa, se le enviaría esa clave a un tercero.
    const usaServidorPropio = !input.evolutionApiUrl || input.evolutionApiUrl === process.env.EVOLUTION_API_URL;
    const evolutionApiKey = input.evolutionApiKey || (usaServidorPropio ? process.env.EVOLUTION_API_KEY : undefined);
    const instancia = input.instancia || `crm-${organizationId}`;

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new BadRequestException(
        'Falta la URL o la API key de Evolution API. Complétalas en el formulario, o configura EVOLUTION_API_URL / EVOLUTION_API_KEY en el servidor.',
      );
    }
    return { evolutionApiUrl, evolutionApiKey, instancia };
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

  private async guardar(
    organizationId: string,
    canal: CanalMensajeria,
    credenciales: unknown,
    estado: EstadoIntegracion,
    etiqueta: string,
    opciones: { mantenerConectadoEn?: boolean } = {},
  ) {
    const cifrado = cifrarTexto(JSON.stringify(credenciales));
    // Prisma tipa los campos Bytes como Uint8Array<ArrayBuffer>; Buffer no es estructuralmente
    // idéntico (su .buffer es ArrayBufferLike), así que se envuelve explícito.
    const data = new Uint8Array(cifrado.data);
    const iv = new Uint8Array(cifrado.iv);
    const tag = new Uint8Array(cifrado.tag);
    const conectadoEn = estado === 'CONECTADO' ? new Date() : opciones.mantenerConectadoEn ? undefined : null;

    return this.prisma.integracionCanal.upsert({
      where: { organizationId_canal: { organizationId, canal } },
      create: { organizationId, canal, estado, etiqueta, configCifrada: data, configIv: iv, configTag: tag, conectadoEn: conectadoEn ?? null },
      update: { estado, etiqueta, configCifrada: data, configIv: iv, configTag: tag, conectadoEn },
      select: SELECT,
    });
  }

  private verificar(input: Exclude<ConectarIntegracionInput, { canal: 'WHATSAPP_QR' }>): Promise<string> {
    switch (input.canal) {
      case 'WHATSAPP_API': return verificarWhatsappApi(input.credenciales);
      case 'MESSENGER': return verificarMessenger(input.credenciales);
      case 'INSTAGRAM': return verificarInstagram(input.credenciales);
      case 'TIKTOK': return verificarTiktok(input.credenciales);
    }
  }
}
