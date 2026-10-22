import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegracionesService } from '../integraciones/integraciones.service';
import type {
  CredencialesWhatsappApi, EtapaPipeline, TipoMensaje,
  ConversacionEstado as ConversacionEstadoInput,
} from '@totalcrm/shared';
import { enviarTextoMeta } from '../integraciones/meta-client';
import { webhookSecretValido, firmaMetaValida } from '../common/webhook-url';
import { etapaPipelineValida } from '../common/etapa-pipeline';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { guardarMensajeSaliente } from './mensaje-saliente';
import { BotEngineService } from '../bots/engine/bot-engine.service';

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

/** WhatsApp se atiende únicamente por la API oficial de Meta (WhatsApp Business Platform): la
 * conexión por código QR (Evolution API) no está autorizada para uso institucional. */
const CANAL_WHATSAPP = 'WHATSAPP_API' as const;

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

  /** Oculta la conversación del inbox — no la purga de verdad, así se conserva el historial
   * con el socio. Un mensaje nuevo de ese contacto la reactiva sola. */
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

  /** Abre (o reabre) la conversación con un número. Ojo: escribirle primero a un contacto que
   *  nunca escribió está sujeto a la regla de Meta de plantilla pre-aprobada — un texto libre
   *  fuera de la ventana de 24 h lo rechaza la propia API de Meta. */
  async iniciarConversacion(organizationId: string, numero: string) {
    const contactoId = numero.replace(/\D/g, '');
    if (!contactoId) throw new BadRequestException('Número inválido');
    return this.prisma.conversacion.upsert({
      where: { organizationId_canal_contactoId: { organizationId, canal: CANAL_WHATSAPP, contactoId } },
      create: { organizationId, canal: CANAL_WHATSAPP, contactoId },
      update: { eliminadaEn: null },
    });
  }

  async enviarMensaje(organizationId: string, conversacionId: string, contenido: string) {
    const conversacion = await this.prepararEnvio(organizationId, conversacionId);
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, CANAL_WHATSAPP)) as CredencialesWhatsappApi | null;
    if (!credenciales) throw new BadRequestException('WhatsApp Business (API oficial) no está conectado. Ve a Configuración → Integraciones.');
    const { remoteId } = await enviarTextoMeta(credenciales, conversacion.contactoId, contenido);
    // Envío manual desde el inbox (un humano escribiendo) — `pausarBot: true` porque a partir
    // de este momento la conversación la lleva una persona, no el bot.
    return guardarMensajeSaliente(this.prisma, { conversacionId, tipo: 'TEXTO', contenido, remoteId, pausarBot: true });
  }

  /** Handshake de verificación que Meta hace UNA vez al pegar la URL en su dashboard (y cada
   * vez que se re-verifica). `secret` valida que la URL es la nuestra; `verifyToken` tiene
   * que coincidir con el que el usuario guardó al conectar WHATSAPP_API en /configuracion. */
  async verificarWebhookMeta(organizationId: string, secret: string, modo: string, verifyToken: string): Promise<boolean> {
    if (!webhookSecretValido(organizationId, secret)) return false;
    if (modo !== 'subscribe') return false;
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, CANAL_WHATSAPP)) as CredencialesWhatsappApi | null;
    return !!credenciales && verifyToken === credenciales.verifyToken;
  }

  /** Procesa un evento entrante de Meta Cloud API (push). Meta no tiene un endpoint para
   * "traer el historial": sin este webhook alcanzable desde internet, los mensajes entrantes
   * no le llegan al CRM de ninguna otra forma. */
  async procesarWebhookMeta(organizationId: string, secret: string, payload: unknown, firmado: { rawBody?: Buffer; firma?: string }) {
    if (!webhookSecretValido(organizationId, secret)) throw new UnauthorizedException('Firma inválida');
    const credenciales = (await this.integraciones.credencialesDescifradas(organizationId, CANAL_WHATSAPP)) as CredencialesWhatsappApi | null;
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

  /** Guarda un mensaje entrante de Meta de forma idempotente (Meta reintenta los webhooks que
   * no respondieron a tiempo, así que el mismo `id` puede llegar más de una vez). */
  private async registrarMensajeMeta(organizationId: string, msg: MetaMensajeEntrante, nombreContacto?: string): Promise<boolean> {
    const contactoId = msg.from;
    if (!contactoId) return false;
    const { tipo, contenido } = detectarTipoYContenidoMeta(msg);
    const enviadoEn = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

    if (msg.id) {
      const previa = await this.prisma.conversacion.findUnique({
        where: { organizationId_canal_contactoId: { organizationId, canal: CANAL_WHATSAPP, contactoId } },
      });
      if (previa) {
        const existente = await this.prisma.mensaje.findUnique({
          where: { conversacionId_remoteId: { conversacionId: previa.id, remoteId: msg.id } },
        });
        if (existente) return false;
      }
    }

    const conversacion = await this.prisma.conversacion.upsert({
      where: { organizationId_canal_contactoId: { organizationId, canal: CANAL_WHATSAPP, contactoId } },
      create: {
        organizationId, canal: CANAL_WHATSAPP, contactoId,
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

  private async prepararEnvio(organizationId: string, conversacionId: string) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id: conversacionId, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    if (conversacion.canal !== CANAL_WHATSAPP) {
      throw new BadRequestException('El envío solo está disponible por WhatsApp Business (API oficial).');
    }
    return conversacion;
  }

  /** Pausa o reactiva el motor de bots para esta conversación (toggle manual desde el inbox). */
  async pausarBot(organizationId: string, id: string, pausado: boolean) {
    const conversacion = await this.prisma.conversacion.findFirst({ where: { id, organizationId } });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada');
    await this.prisma.conversacion.update({ where: { id }, data: { botPausado: pausado } });
    return this.obtenerConversacion(organizationId, id);
  }
}
