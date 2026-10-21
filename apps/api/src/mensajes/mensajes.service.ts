import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegracionesService } from '../integraciones/integraciones.service';
import type {
  CredencialesWhatsappQrResueltas, CredencialesWhatsappApi, EtapaPipeline, TipoMensaje,
  ConversacionEstado as ConversacionEstadoInput,
} from '@totalcrm/shared';
import {
  enviarWhatsappQr, enviarAudioWhatsappQr, enviarStickerWhatsappQr, enviarArchivoWhatsappQr, obtenerMediaWhatsappQr,
  obtenerFotoPerfilWhatsappQr,
} from './evolution-client';
import { enviarTextoMeta } from '../integraciones/meta-client';
import { webhookSecretValido, firmaMetaValida, urlWebhookEvolution } from '../common/webhook-url';
import { etapaPipelineValida } from '../common/etapa-pipeline';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { guardarMensajeSaliente } from './mensaje-saliente';
import { BotEngineService } from '../bots/engine/bot-engine.service';

/** WhatsApp identifica contactos por `remoteJid`, pero cuando usan "lid" (identificador
 * enlazado, una capa de privacidad nueva de WhatsApp) el `remoteJid` NO es el número real —
 * el número real viaja en `remoteJidAlt`. Hay que preferir `remoteJidAlt` cuando exista, si
 * no las conversaciones entrantes quedan agrupadas por un id que no corresponde al mismo
 * contacto que los mensajes salientes (que sí usan el número). Confirmado con datos reales
 * de `chat/findMessages` (ver memoria del proyecto). El `remoteJid` ORIGINAL (con o sin lid)
 * se guarda aparte en Mensaje.remoteJid porque Evolution lo necesita tal cual para volver a
 * pedir el archivo de un mensaje de media (`getBase64FromMediaMessage`).
 */
interface EvolutionMensajeItem {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string; remoteJidAlt?: string };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    audioMessage?: { ptt?: boolean };
    stickerMessage?: Record<string, unknown>;
    documentMessage?: { fileName?: string; title?: string };
  };
  messageTimestamp?: number;
  pushName?: string;
}

/** Forma (recortada a lo que usamos) del payload que manda Meta Cloud API a un webhook de
 * WhatsApp Business Platform — ver developers.facebook.com/docs/whatsapp/cloud-api/webhooks. */
interface MetaWebhookBody {
  object?: string;
  entry?: { id?: string; changes?: { field?: string; value?: MetaWebhookValue }[] }[];
}
interface MetaWebhookValue {
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: MetaMensajeEntrante[];
}
interface MetaMensajeEntrante {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  audio?: unknown;
  sticker?: unknown;
  document?: { filename?: string; caption?: string };
}

function detectarTipoYContenidoMeta(msg: MetaMensajeEntrante): { tipo: TipoMensaje; contenido: string } {
  if (msg.type === 'text') return { tipo: 'TEXTO', contenido: msg.text?.body || '' };
  if (msg.type === 'image') return { tipo: 'IMAGEN', contenido: msg.image?.caption || 'Imagen' };
  if (msg.type === 'video') return { tipo: 'VIDEO', contenido: msg.video?.caption || 'Video' };
  if (msg.type === 'audio') return { tipo: 'AUDIO', contenido: 'Audio' };
  if (msg.type === 'sticker') return { tipo: 'STICKER', contenido: 'Sticker' };
  if (msg.type === 'document') return { tipo: 'DOCUMENTO', contenido: msg.document?.filename || msg.document?.caption || 'Documento' };
  return { tipo: 'TEXTO', contenido: '[mensaje no soportado todavía]' };
}

const TIMEOUT_MS = 10_000;
const MAX_PAGINAS_SYNC = 5;

/** La "etapa" que se muestra como etiqueta junto a una conversación es la de la oportunidad
 * (del cliente o lead vinculado) actualizada más recientemente — la más relevante para saber
 * "dónde va" en el embudo de ventas ahora mismo. */
const OPORTUNIDAD_ACTUAL = {
  orderBy: { updatedAt: 'desc' as const },
  take: 1,
  select: { id: true, etapa: true },
};

const CONVERSACION_INCLUDE_LISTA = {
  cliente: { select: { id: true, razonSocial: true, oportunidades: OPORTUNIDAD_ACTUAL } },
  lead: { select: { id: true, nombre: true, oportunidades: OPORTUNIDAD_ACTUAL } },
  asignadoA: { select: { id: true, user: { select: { id: true, nombre: true, email: true } } } },
  mensajes: { orderBy: { enviadoEn: 'desc' as const }, take: 1 },
};

function detectarTipoYContenido(message: EvolutionMensajeItem['message']): { tipo: TipoMensaje; contenido: string } {
  if (message?.conversation) return { tipo: 'TEXTO', contenido: message.conversation };
  if (message?.extendedTextMessage?.text) return { tipo: 'TEXTO', contenido: message.extendedTextMessage.text };
  if (message?.imageMessage) return { tipo: 'IMAGEN', contenido: message.imageMessage.caption || 'Imagen' };
  if (message?.videoMessage) return { tipo: 'VIDEO', contenido: message.videoMessage.caption || 'Video' };
  if (message?.audioMessage) return { tipo: 'AUDIO', contenido: message.audioMessage.ptt ? 'Nota de voz' : 'Audio' };
  if (message?.stickerMessage) return { tipo: 'STICKER', contenido: 'Sticker' };
  if (message?.documentMessage) return { tipo: 'DOCUMENTO', contenido: message.documentMessage.fileName || message.documentMessage.title || 'Documento' };
  return { tipo: 'TEXTO', contenido: '[mensaje no soportado todavía]' };
}

@Injectable()
export class MensajesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integraciones: IntegracionesService,
    private readonly notificaciones: NotificacionesService,
    private readonly botEngine: BotEngineService,
  ) {}

  listarConversaciones(organizationId: string) {
    return this.prisma.conversacion.findMany({
      where: { organizationId, eliminadaEn: null },
      orderBy: { ultimoMensajeEn: 'desc' },
      include: CONVERSACION_INCLUDE_LISTA,
    });
  }

  async obtenerConversacion(organizationId: string, id: string) {
    const conversacion = await this.prisma.conversacion.findFirst({
      where: { id, organizationId, eliminadaEn: null },
      include: {
        ...CONVERSACION_INCLUDE_LISTA,
        mensajes: { orderBy: { enviadoEn: 'asc' } },
        notas: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (conversacion.noLeidos > 0) {
      await this.prisma.conversacion.update({ where: { id }, data: { noLeidos: 0 } });
    }
    return conversacion;
  }

  /** Oculta la conversación del inbox — no la purga de verdad. El CRM re-sincroniza
   * el historial completo desde Evolution API cada pocos segundos (no hay webhook público en
   * desarrollo local), así que si se borrara la fila la siguiente sincronización la traería de
   * vuelta con todo su historial viejo. Un mensaje genuinamente nuevo la reactiva solo. */
  async eliminarConversacion(organizationId: string, id: string) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId, eliminadaEn: null } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    await this.prisma.conversacion.update({ where: { id }, data: { eliminadaEn: new Date() } });
    return { ok: true };
  }

  /** Vincula (o desvincula, con `clienteId: null`) esta conversación a un cliente del CRM —
   * necesario para poder asignarle una etapa del pipeline (esa vive en la Oportunidad del
   * cliente, no en la conversación). Vincular a un cliente desvincula el lead, si tenía uno:
   * una conversación representa a un solo contacto en el pipeline a la vez. */
  async vincularCliente(organizationId: string, id: string, clienteId: string | null) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (clienteId) {
      const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, organizationId } });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');
    }
    await this.prisma.conversacion.update({ where: { id }, data: { clienteId, leadId: clienteId ? null : undefined } });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Igual que `vincularCliente` pero para un Lead — la vía normal para "etiquetar" un
   * contacto de WhatsApp que todavía no es cliente (Lead no exige cédula/RUC, a diferencia
   * de Cliente, así que es el punto de entrada natural desde el inbox). */
  async vincularLead(organizationId: string, id: string, leadId: string | null) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
      if (!lead) throw new NotFoundException('Lead no encontrado');
    }
    await this.prisma.conversacion.update({ where: { id }, data: { leadId, clienteId: leadId ? null : undefined } });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Crea un Lead a partir de este contacto de WhatsApp y lo vincula de una — el atajo para
   * "meter al pipeline" a alguien que escribió sin salir del inbox a llenar el formulario de
   * Leads. `nombre` es editable en el momento (por defecto usa el nombre de WhatsApp o, si no
   * hay, el número). */
  async crearLeadDesdeConversacion(organizationId: string, id: string, nombre?: string) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId, eliminadaEn: null } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        nombre: nombre?.trim() || conversacion.contactoNombre || conversacion.contactoId,
        telefono: conversacion.contactoId,
        fuente: 'WhatsApp',
      },
    });
    await this.prisma.conversacion.update({ where: { id }, data: { leadId: lead.id, clienteId: null } });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Mueve al cliente o lead de la conversación a otra etapa del pipeline: actualiza su
   * oportunidad más reciente, o crea una nueva si todavía no tiene ninguna (permite
   * "etiquetar" la conversación con una etapa sin salir del inbox). */
  async actualizarEtapaPipeline(organizationId: string, id: string, etapa: EtapaPipeline) {
    if (!(await etapaPipelineValida(this.prisma, organizationId, etapa))) {
      throw new BadRequestException('Esa etapa no existe en este workspace');
    }
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (!conversacion.clienteId && !conversacion.leadId) {
      throw new BadRequestException('Vincula esta conversación a un cliente o lead para poder asignarle una etapa del pipeline.');
    }

    const filtro = conversacion.clienteId
      ? { organizationId, clienteId: conversacion.clienteId }
      : { organizationId, leadId: conversacion.leadId! };
    const oportunidad = await this.prisma.oportunidad.findFirst({ where: filtro, orderBy: { updatedAt: 'desc' } });
    if (oportunidad) {
      await this.prisma.oportunidad.update({ where: { id: oportunidad.id }, data: { etapa } });
    } else {
      await this.prisma.oportunidad.create({
        data: {
          ...filtro, etapa,
          titulo: `Chat con ${conversacion.contactoNombre ?? conversacion.contactoId}`,
        },
      });
    }
    return this.obtenerConversacion(organizationId, id);
  }

  /** Estado de triage del inbox (Abierta / Pendiente / Resuelta) — no tiene relación con el
   * pipeline de ventas, es solo para saber qué conversaciones ya están atendidas. */
  async actualizarEstado(organizationId: string, id: string, estado: ConversacionEstadoInput) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    await this.prisma.conversacion.update({ where: { id }, data: { estado } });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Asigna (o desasigna, con `membershipId: null`) la conversación a un miembro del equipo. */
  async asignar(organizationId: string, id: string, membershipId: string | null) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (membershipId) {
      const miembro = await this.prisma.membership.findFirst({ where: { id: membershipId, organizationId } });
      if (!miembro) throw new NotFoundException('Miembro no encontrado en esta organización');
    }
    await this.prisma.conversacion.update({ where: { id }, data: { asignadoAId: membershipId } });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Nota interna del equipo sobre la conversación — nunca se envía al contacto por WhatsApp. */
  async agregarNota(organizationId: string, id: string, userId: string, contenido: string) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    const usuario = await this.prisma.user.findUnique({ where: { id: userId }, select: { nombre: true } });
    await this.prisma.notaConversacion.create({
      data: { conversacionId: id, autorNombre: usuario?.nombre ?? 'Alguien del equipo', contenido },
    });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Borra el mensaje solo del inbox — NO intenta "eliminar para todos" en
   * WhatsApp (esa es una acción distinta y más delicada; se puede agregar aparte si se
   * necesita). Recalcula `ultimoMensajeEn` de la conversación con lo que quede. */
  async eliminarMensaje(organizationId: string, conversacionId: string, mensajeId: string) {
    const mensaje = await this.prisma.mensaje.findFirst({
      where: { id: mensajeId, conversacionId, conversacion: { organizationId } },
    });
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado');

    await this.prisma.mensaje.delete({ where: { id: mensajeId } });

    const ultimo = await this.prisma.mensaje.findFirst({
      where: { conversacionId },
      orderBy: { enviadoEn: 'desc' },
    });
    await this.prisma.conversacion.update({
      where: { id: conversacionId },
      data: { ultimoMensajeEn: ultimo?.enviadoEn ?? null },
    });
    return { ok: true };
  }

  /** `canal` decide dónde nace la conversación nueva — antes quedaba fijo a WHATSAPP_QR sin
   *  importar cuál estuviera conectado, así que "+ Nueva conversación" en el inbox creaba una
   *  conversación QR aunque la org solo tuviera WHATSAPP_API conectado (el envío fallaba
   *  después, silenciosamente confuso). Ojo: escribirle primero a un contacto de WHATSAPP_API
   *  que nunca escribió sigue sujeto a la regla de Meta de plantilla pre-aprobada — eso no es
   *  un bug del CRM, lo va a rechazar la API real al intentar mandar texto libre. */
  async iniciarConversacion(organizationId: string, numero: string, canal: 'WHATSAPP_QR' | 'WHATSAPP_API' = 'WHATSAPP_QR') {
    const contactoId = numero.replace(/\D/g, '');
    if (!contactoId) throw new BadRequestException('Número inválido');
    const conversacion = await this.prisma.conversacion.upsert({
      where: { organizationId_canal_contactoId: { organizationId, canal, contactoId } },
      create: { organizationId, canal, contactoId },
      update: { eliminadaEn: null },
    });
    if (canal === 'WHATSAPP_QR' && !conversacion.fotoUrl) {
      const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_QR')) as CredencialesWhatsappQrResueltas | null;
      if (credenciales) {
        const fotoUrl = await this.buscarFotoPerfil(credenciales, contactoId);
        if (fotoUrl) return this.prisma.conversacion.update({ where: { id: conversacion.id }, data: { fotoUrl } });
      }
    }
    return conversacion;
  }

  async enviarMensaje(organizationId: string, conversacionId: string, contenido: string) {
    const conversacion = await this.prepararEnvio(organizationId, conversacionId);
    const remoteId = await this.enviarTextoPorCanal(organizationId, conversacion.canal, conversacion.contactoId, contenido);
    return this.guardarSaliente(conversacionId, 'TEXTO', contenido, remoteId);
  }

  async enviarAudio(organizationId: string, conversacionId: string, audioBase64: string) {
    const conversacion = await this.prepararEnvio(organizationId, conversacionId);
    const credenciales = await this.credencialesQrObligatorias(organizationId, conversacion.canal);
    const resultado = await enviarAudioWhatsappQr(credenciales, conversacion.contactoId, limpiarBase64(audioBase64));
    return this.guardarSaliente(conversacionId, 'AUDIO', 'Nota de voz', resultado.remoteId);
  }

  async enviarSticker(organizationId: string, conversacionId: string, stickerBase64: string) {
    const conversacion = await this.prepararEnvio(organizationId, conversacionId);
    const credenciales = await this.credencialesQrObligatorias(organizationId, conversacion.canal);
    const resultado = await enviarStickerWhatsappQr(credenciales, conversacion.contactoId, limpiarBase64(stickerBase64));
    return this.guardarSaliente(conversacionId, 'STICKER', 'Sticker', resultado.remoteId);
  }

  async enviarArchivo(
    organizationId: string, conversacionId: string,
    params: { contenido: string; mimetype: string; nombreArchivo?: string; caption?: string },
  ) {
    const conversacion = await this.prepararEnvio(organizationId, conversacionId);
    const credenciales = await this.credencialesQrObligatorias(organizationId, conversacion.canal);
    const mediatype = params.mimetype.startsWith('image/') ? 'image' : params.mimetype.startsWith('video/') ? 'video' : 'document';
    const resultado = await enviarArchivoWhatsappQr(credenciales, conversacion.contactoId, {
      mediatype, mimetype: params.mimetype, media: limpiarBase64(params.contenido),
      fileName: params.nombreArchivo, caption: params.caption,
    });
    const tipo: TipoMensaje = mediatype === 'image' ? 'IMAGEN' : mediatype === 'video' ? 'VIDEO' : 'DOCUMENTO';
    return this.guardarSaliente(conversacionId, tipo, params.caption || params.nombreArchivo || 'Archivo', resultado.remoteId);
  }

  /** Vuelve a pedirle el archivo (imagen/video/audio/sticker/documento) a Evolution para un
   * mensaje ya recibido — no se guarda una copia en el CRM, se descarga bajo demanda cuando
   * el usuario abre/reproduce el mensaje (evita inflar la base de datos con binarios). */
  async obtenerMedia(organizationId: string, conversacionId: string, mensajeId: string) {
    const mensaje = await this.prisma.mensaje.findFirst({
      where: { id: mensajeId, conversacionId, conversacion: { organizationId } },
    });
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado');
    if (mensaje.tipo === 'TEXTO') throw new BadRequestException('Este mensaje no tiene archivo adjunto');
    if (!mensaje.remoteId || !mensaje.remoteJid) throw new BadRequestException('No se guardó la referencia original de este archivo (mensaje anterior a esta función)');

    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_QR')) as CredencialesWhatsappQrResueltas | null;
    if (!credenciales) throw new BadRequestException('WhatsApp (código QR) no está conectado.');

    return obtenerMediaWhatsappQr(credenciales, {
      id: mensaje.remoteId, remoteJid: mensaje.remoteJid, fromMe: mensaje.direccion === 'SALIENTE',
    });
  }

  /** Diagnóstico: la URL que el CRM configura automáticamente en Evolution al conectar. */
  urlWebhook(organizationId: string, origen: string) {
    return urlWebhookEvolution(organizationId, origen);
  }

  /** Procesa un evento entrante de Evolution API (push, en tiempo real). Requiere que
   * el CRM tenga una URL pública alcanzable por el servidor Evolution. */
  async procesarWebhookEvolution(organizationId: string, secret: string, payload: unknown) {
    if (!webhookSecretValido(organizationId, secret)) throw new UnauthorizedException('Firma inválida');

    const body = payload as { event?: string; data?: EvolutionMensajeItem | EvolutionMensajeItem[] };
    if (body.event !== 'messages.upsert' || !body.data) return { ok: true };

    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_QR')) as CredencialesWhatsappQrResueltas | null;
    const fotosIntentadas = new Set<string>();
    const items = Array.isArray(body.data) ? body.data : [body.data];
    for (const item of items) {
      await this.registrarMensaje(organizationId, item, true, credenciales ?? undefined, fotosIntentadas);
    }
    return { ok: true };
  }

  /** Handshake de verificación que Meta hace UNA vez al pegar la URL en su dashboard (y cada
   * vez que se re-verifica). `secret` valida que la URL es la nuestra; `verifyToken` tiene
   * que coincidir con el que el usuario guardó al conectar WHATSAPP_API en /configuracion. */
  async verificarWebhookMeta(organizationId: string, secret: string, modo: string, verifyToken: string): Promise<boolean> {
    if (!webhookSecretValido(organizationId, secret)) return false;
    if (modo !== 'subscribe') return false;
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_API')) as CredencialesWhatsappApi | null;
    return !!credenciales && verifyToken === credenciales.verifyToken;
  }

  /** Procesa un evento entrante de Meta Cloud API (push). A diferencia de Evolution, Meta no
   * tiene un endpoint para "traer el historial" — sin este webhook alcanzable públicamente,
   * los mensajes entrantes por WHATSAPP_API no le llegan al CRM de ninguna otra forma. */
  async procesarWebhookMeta(organizationId: string, secret: string, payload: unknown, firmado: { rawBody?: Buffer; firma?: string }) {
    if (!webhookSecretValido(organizationId, secret)) throw new UnauthorizedException('Firma inválida');
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_API')) as CredencialesWhatsappApi | null;
    if (credenciales?.appSecret && !firmaMetaValida(firmado.rawBody, firmado.firma, credenciales.appSecret)) {
      throw new UnauthorizedException('Firma de Meta inválida');
    }

    const body = payload as MetaWebhookBody;
    if (body.object !== 'whatsapp_business_account') return { ok: true };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages' || !change.value?.messages) continue;
        const nombresPorNumero = new Map((change.value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
        for (const msg of change.value.messages) {
          await this.registrarMensajeMeta(organizationId, msg, msg.from ? nombresPorNumero.get(msg.from) : undefined);
        }
      }
    }
    return { ok: true };
  }

  /** Análogo a registrarMensaje() pero para el payload de Meta — no comparte código con la
   * versión de Evolution a propósito: los formatos no tienen nada en común (jid vs. wa_id,
   * remoteJidAlt, etc.) y forzar una abstracción común los haría más frágiles a ambos. */
  private async registrarMensajeMeta(organizationId: string, msg: MetaMensajeEntrante, nombreContacto?: string): Promise<boolean> {
    const contactoId = msg.from;
    if (!contactoId) return false;
    const { tipo, contenido } = detectarTipoYContenidoMeta(msg);
    const enviadoEn = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

    if (msg.id) {
      const previa = await this.prisma.conversacion.findUnique({
        where: { organizationId_canal_contactoId: { organizationId, canal: 'WHATSAPP_API', contactoId } },
      });
      if (previa) {
        const existente = await this.prisma.mensaje.findUnique({
          where: { conversacionId_remoteId: { conversacionId: previa.id, remoteId: msg.id } },
        });
        if (existente) return false;
      }
    }

    const conversacion = await this.prisma.conversacion.upsert({
      where: { organizationId_canal_contactoId: { organizationId, canal: 'WHATSAPP_API', contactoId } },
      create: {
        organizationId, canal: 'WHATSAPP_API', contactoId,
        contactoNombre: nombreContacto, ultimoMensajeEn: enviadoEn,
        noLeidos: 1, estado: 'PENDIENTE',
      },
      update: {
        contactoNombre: nombreContacto ?? undefined,
        ultimoMensajeEn: enviadoEn,
        noLeidos: { increment: 1 },
        estado: 'PENDIENTE',
        eliminadaEn: null, // un entrante genuino reabre la conversación aunque estuviera oculta
      },
    });

    try {
      await this.prisma.mensaje.create({
        data: { conversacionId: conversacion.id, direccion: 'ENTRANTE', tipo, contenido, remoteId: msg.id, enviadoEn },
      });
      void this.notificaciones.crear(
        organizationId, 'MENSAJE_NUEVO',
        `Nuevo mensaje de ${conversacion.contactoNombre || contactoId}`,
        contenido.slice(0, 120), '/mensajes',
      );
      void this.botEngine.procesarMensajeEntrante(organizationId, conversacion.id, contenido).catch(() => {});
      return true;
    } catch {
      return false; // remoteId duplicado por una carrera (webhook reintentado por Meta)
    }
  }

  /** Alternativa al webhook cuando el CRM no tiene URL pública (ej. desarrollo local):
   * en vez de esperar a que Evolution empuje los mensajes, se los pedimos nosotros. Trae
   * el historial reciente de TODAS las conversaciones de la instancia (paginado) y lo
   * guarda — es idempotente (el `remoteId` único evita duplicar mensajes ya sincronizados).
   *
   * En la primera sincronización de la org no se marca nada como "no leído" (es historial
   * de respaldo, no actividad nueva); en sincronizaciones siguientes sí, para reflejar
   * mensajes genuinamente nuevos desde la última vez. */
  async sincronizarWhatsappQr(organizationId: string) {
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_QR')) as CredencialesWhatsappQrResueltas | null;
    if (!credenciales) throw new BadRequestException('WhatsApp (código QR) no está conectado. Ve a Configuración → Integraciones.');

    const yaHabiaMensajes = (await this.prisma.mensaje.count({
      where: { conversacion: { organizationId, canal: 'WHATSAPP_QR' } },
    })) > 0;

    const base = credenciales.evolutionApiUrl.replace(/\/+$/, '');
    const fotosIntentadas = new Set<string>();
    let nuevos = 0;
    for (let pagina = 1; pagina <= MAX_PAGINAS_SYNC; pagina++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${base}/chat/findMessages/${encodeURIComponent(credenciales.instancia)}`, {
          method: 'POST',
          headers: { apikey: credenciales.evolutionApiKey, 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ page: pagina }),
        });
      } catch {
        if (pagina === 1) throw new BadRequestException('No se pudo contactar tu servidor Evolution API para sincronizar (tiempo de espera agotado).');
        break;
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        if (pagina === 1) throw new BadRequestException(`Evolution API respondió ${res.status} al sincronizar mensajes.`);
        break;
      }

      const body = (await res.json()) as { messages?: { records?: EvolutionMensajeItem[]; pages?: number } };
      const records = body.messages?.records ?? [];
      if (records.length === 0) break;

      for (const r of records) {
        const creado = await this.registrarMensaje(organizationId, r, !yaHabiaMensajes ? false : undefined, credenciales, fotosIntentadas);
        if (creado) nuevos++;
      }

      const totalPaginas = body.messages?.pages ?? 1;
      if (pagina >= totalPaginas) break;
    }
    return { nuevos };
  }

  private async prepararEnvio(organizationId: string, conversacionId: string) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id: conversacionId, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (conversacion.canal !== 'WHATSAPP_QR' && conversacion.canal !== 'WHATSAPP_API') {
      throw new BadRequestException('El envío todavía solo está disponible para WhatsApp (QR o API oficial). Los demás canales llegan pronto.');
    }
    return conversacion;
  }

  /** Credenciales QR, obligatorias — usado por los envíos que todavía NO tienen equivalente
   * en WHATSAPP_API (notas de voz, stickers, archivos). El texto sí funciona en ambos canales
   * (ver enviarTextoPorCanal). */
  private async credencialesQrObligatorias(organizationId: string, canal: string): Promise<CredencialesWhatsappQrResueltas> {
    if (canal !== 'WHATSAPP_QR') {
      throw new BadRequestException('Notas de voz, stickers y archivos por ahora solo están disponibles en WhatsApp (código QR).');
    }
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_QR')) as CredencialesWhatsappQrResueltas | null;
    if (!credenciales) throw new BadRequestException('WhatsApp (código QR) no está conectado. Ve a Configuración → Integraciones.');
    return credenciales;
  }

  /** Envía texto por el canal real de la conversación — QR (Evolution) o API oficial (Meta). */
  private async enviarTextoPorCanal(organizationId: string, canal: string, numero: string, texto: string): Promise<string | undefined> {
    if (canal === 'WHATSAPP_API') {
      const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_API')) as CredencialesWhatsappApi | null;
      if (!credenciales) throw new BadRequestException('WhatsApp (API oficial) no está conectado. Ve a Configuración → Integraciones.');
      const resultado = await enviarTextoMeta(credenciales, numero, texto);
      return resultado.remoteId;
    }
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_QR')) as CredencialesWhatsappQrResueltas | null;
    if (!credenciales) throw new BadRequestException('WhatsApp (código QR) no está conectado. Ve a Configuración → Integraciones.');
    const resultado = await enviarWhatsappQr(credenciales, numero, texto);
    return resultado.remoteId;
  }

  /** Envío manual desde el inbox (un humano escribiendo) — `pausarBot: true`
   * porque a partir de este momento la conversación la lleva una persona, no el bot. */
  private guardarSaliente(conversacionId: string, tipo: TipoMensaje, contenido: string, remoteId?: string) {
    return guardarMensajeSaliente(this.prisma, { conversacionId, tipo, contenido, remoteId, pausarBot: true });
  }

  /** Pausa o reactiva el motor de bots para esta conversación (toggle manual desde el inbox). */
  async pausarBot(organizationId: string, id: string, pausado: boolean) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    await this.prisma.conversacion.update({ where: { id }, data: { botPausado: pausado } });
    return this.obtenerConversacion(organizationId, id);
  }

  /** Guarda un mensaje (de webhook o de sincronización) de forma idempotente. Devuelve si
   * era nuevo o ya existía. `marcarNoLeido=false` fuerza a no incrementar el contador de no
   * leídos (usado en la primera sincronización, que es historial, no actividad nueva);
   * `undefined` = comportamiento normal (incrementa si es ENTRANTE). */
  private async registrarMensaje(
    organizationId: string, item: EvolutionMensajeItem, marcarNoLeido: boolean | undefined,
    credenciales?: CredencialesWhatsappQrResueltas, fotosIntentadas?: Set<string>,
  ): Promise<boolean> {
    const jidOriginal = item.key?.remoteJid;
    const jid = item.key?.remoteJidAlt || jidOriginal;
    if (!jid || !jidOriginal) return false;
    const contactoId = jid.split('@')[0];
    const direccion = item.key?.fromMe ? 'SALIENTE' : 'ENTRANTE';
    const { tipo, contenido } = detectarTipoYContenido(item.message);
    const enviadoEn = item.messageTimestamp ? new Date(item.messageTimestamp * 1000) : new Date();

    const previa = await this.prisma.conversacion.findUnique({
      where: { organizationId_canal_contactoId: { organizationId, canal: 'WHATSAPP_QR', contactoId } },
    });

    if (item.key?.id && previa) {
      const existente = await this.prisma.mensaje.findUnique({
        where: { conversacionId_remoteId: { conversacionId: previa.id, remoteId: item.key.id } },
      });
      if (existente) {
        // Autorreparación: mensajes sincronizados antes de que existiera Mensaje.remoteJid
        // (o Mensaje.tipo) se quedaron sin esos datos — se completan ahora si faltan, sin
        // duplicar el mensaje ni tocar su contenido ya guardado.
        if (!existente.remoteJid || existente.tipo !== tipo) {
          await this.prisma.mensaje.update({
            where: { id: existente.id },
            data: { remoteJid: existente.remoteJid ?? jidOriginal, tipo },
          });
        }
        return false;
      }
    }

    const debeActualizarUltimo = !previa?.ultimoMensajeEn || previa.ultimoMensajeEn < enviadoEn;
    const incrementarNoLeidos = direccion === 'ENTRANTE' && marcarNoLeido !== false;
    // Si la conversación estaba oculta (borrada por el usuario) y este mensaje es POSTERIOR
    // al momento del borrado, es actividad genuinamente nueva: se reactiva sola. Si es un
    // mensaje viejo (re-sincronizado desde el historial de Evolution), se guarda igual pero
    // la conversación se queda oculta — así no "revive" solo por volver a traer el pasado.
    const reactivar = !!previa?.eliminadaEn && enviadoEn > previa.eliminadaEn;

    const conversacion = await this.prisma.conversacion.upsert({
      where: { organizationId_canal_contactoId: { organizationId, canal: 'WHATSAPP_QR', contactoId } },
      create: {
        organizationId, canal: 'WHATSAPP_QR', contactoId,
        contactoNombre: item.pushName, ultimoMensajeEn: enviadoEn,
        noLeidos: incrementarNoLeidos ? 1 : 0,
        // Un mensaje entrante genuino (no historial) siempre "reabre" la conversación como
        // Pendiente — necesita respuesta. El usuario la marca Resuelta a mano cuando ya
        // contestó; si es solo historial de la primera sincronización, se deja el default.
        estado: incrementarNoLeidos ? 'PENDIENTE' : undefined,
      },
      update: {
        contactoNombre: item.pushName ?? undefined,
        ...(debeActualizarUltimo ? { ultimoMensajeEn: enviadoEn } : {}),
        ...(incrementarNoLeidos ? { noLeidos: { increment: 1 }, estado: 'PENDIENTE' } : {}),
        ...(reactivar ? { eliminadaEn: null } : {}),
      },
    });

    if (credenciales && !conversacion.fotoUrl && !fotosIntentadas?.has(conversacion.id)) {
      fotosIntentadas?.add(conversacion.id);
      const fotoUrl = await this.buscarFotoPerfil(credenciales, contactoId);
      if (fotoUrl) await this.prisma.conversacion.update({ where: { id: conversacion.id }, data: { fotoUrl } });
    }

    try {
      await this.prisma.mensaje.create({
        data: { conversacionId: conversacion.id, direccion, tipo, contenido, remoteId: item.key?.id, remoteJid: jidOriginal, enviadoEn },
      });
      if (incrementarNoLeidos) {
        void this.notificaciones.crear(
          organizationId, 'MENSAJE_NUEVO',
          `Nuevo mensaje de ${conversacion.contactoNombre || contactoId}`,
          contenido.slice(0, 120), '/mensajes',
        );
        if (direccion === 'ENTRANTE') {
          void this.botEngine.procesarMensajeEntrante(organizationId, conversacion.id, contenido).catch(() => {});
        }
      }
      return true;
    } catch {
      // remoteId duplicado por una carrera (webhook + sync al mismo tiempo): ya existe, se ignora.
      return false;
    }
  }

  /** Best-effort: si Evolution no expone el endpoint, el contacto no tiene foto, o el
   * servidor no responde, se ignora — nunca debe romper el guardado del mensaje. */
  private async buscarFotoPerfil(credenciales: CredencialesWhatsappQrResueltas, contactoId: string): Promise<string | undefined> {
    try {
      const { profilePictureUrl } = await obtenerFotoPerfilWhatsappQr(credenciales, contactoId);
      return profilePictureUrl;
    } catch {
      return undefined;
    }
  }
}

function limpiarBase64(valor: string): string {
  const i = valor.indexOf('base64,');
  return i === -1 ? valor : valor.slice(i + 'base64,'.length);
}
