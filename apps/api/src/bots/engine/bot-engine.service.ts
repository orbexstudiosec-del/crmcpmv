import { Injectable } from '@nestjs/common';
import { Prisma } from '@totalcrm/db';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracionesService } from '../../integraciones/integraciones.service';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import { guardarMensajeSaliente } from '../../mensajes/mensaje-saliente';
import { enviarTexto, enviarOpciones, enviarMedia } from './canal-sender';
import { calcularSlotsDisponibles } from './agenda';
import type { FlowDefinition, CanalMensajeria } from '@totalcrm/shared';

interface Opcion { id: string; title: string }
type Variables = Record<string, string>;
type Espera = 'INPUT' | 'OPCION' | 'AGENDA' | null;

interface RunState {
  id: string;
  organizationId: string;
  conversacionId: string;
  botFlowId: string;
  nodoActualId: string | null;
  esperando: Espera;
  variables: Variables;
  opcionesPendientes: Opcion[] | null;
  reintentos: number;
}

interface ConversacionCtx {
  id: string;
  contactoId: string;
  contactoNombre: string | null;
  canal: CanalMensajeria;
  clienteId: string | null;
  leadId: string | null;
}

interface RunRow {
  id: string; organizationId: string; conversacionId: string; botFlowId: string;
  nodoActualId: string | null; esperando: string | null; variables: unknown; opcionesPendientes: unknown; reintentos: number;
}

const MAX_REINTENTOS = 3;
const MAX_PASOS = 50; // guardarraíl ante un grafo mal formado con ciclos

/** Motor de ejecución de BotFlow: la pieza que hace que un bot activo responda de verdad a
 * WhatsApp. Todo el punto de entrada público está envuelto en try/catch — el motor jamás
 * debe romper el flujo real de mensajería (webhook/sync) que lo dispara, igual que
 * NotificacionesService absorbe sus propios errores. */
@Injectable()
export class BotEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integraciones: IntegracionesService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async procesarMensajeEntrante(organizationId: string, conversacionId: string, contenido: string): Promise<void> {
    try {
      const conversacion = await this.prisma.conversacion.findUnique({ where: { id: conversacionId } });
      if (!conversacion || conversacion.botPausado) return;

      const bot = await this.prisma.botFlow.findFirst({
        where: { organizationId, activo: true, OR: [{ canal: null }, { canal: conversacion.canal }] },
      });
      if (!bot) return;
      const definicion = bot.definicion as unknown as FlowDefinition;

      const runRow = await this.prisma.botFlowRun.findUnique({ where: { conversacionId } });

      if (runRow && runRow.activa && runRow.esperando) {
        await this.resolverEspera(this.aEstado(runRow), definicion, conversacion, contenido);
        return;
      }

      const trigger = definicion.nodes.find((n) => n.type === 'trigger');
      if (!trigger || trigger.type !== 'trigger') return;
      const dispara = trigger.data.triggerType === 'keyword'
        ? (trigger.data.keywords ?? []).some((k) => k.trim() && contenido.toLowerCase().includes(k.toLowerCase()))
        : !runRow;
      if (!dispara) return;

      const primerEdge = definicion.edges.find((e) => e.source === trigger.id);
      if (!primerEdge) return;

      const run = await this.crearOReiniciarRun(organizationId, conversacionId, bot.id);
      await this.avanzar(run, definicion, conversacion, primerEdge.target);
    } catch {
      // best-effort, ver comentario de la clase
    }
  }

  private async avanzar(run: RunState, definicion: FlowDefinition, conversacion: ConversacionCtx, nodeId: string): Promise<void> {
    let currentId: string | undefined = nodeId;
    let pasos = 0;
    while (currentId && pasos++ < MAX_PASOS) {
      const node = definicion.nodes.find((n) => n.id === currentId);
      if (!node) return this.finalizarRun(run.id);

      const numero = conversacion.contactoId;
      const canal = conversacion.canal;
      const ctx = { nombre: conversacion.contactoNombre ?? '', numero, variables: run.variables };

      switch (node.type) {
        case 'sendMessage': {
          const texto = interpolar(node.data.text, ctx);
          if (node.data.mediaKind && node.data.mediaUrl) {
            const r = await enviarMedia(this.integraciones, run.organizationId, canal, numero, node.data.mediaKind, node.data.mediaUrl, node.data.filename, texto);
            await guardarMensajeSaliente(this.prisma, {
              conversacionId: run.conversacionId, tipo: node.data.mediaKind === 'image' ? 'IMAGEN' : 'DOCUMENTO',
              contenido: texto || (node.data.mediaKind === 'image' ? 'Imagen' : 'Documento'), remoteId: r?.remoteId,
            });
          } else {
            const r = await enviarTexto(this.integraciones, run.organizationId, canal, numero, texto);
            await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: texto, remoteId: r?.remoteId });
          }
          currentId = this.siguiente(definicion, node.id);
          break;
        }
        case 'sendImage': {
          const caption = interpolar(node.data.caption ?? '', ctx);
          const r = await enviarMedia(this.integraciones, run.organizationId, canal, numero, 'image', node.data.imageUrl, undefined, caption);
          await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'IMAGEN', contenido: caption || 'Imagen', remoteId: r?.remoteId });
          currentId = this.siguiente(definicion, node.id);
          break;
        }
        case 'sendDocument': {
          const caption = interpolar(node.data.caption ?? '', ctx);
          const r = await enviarMedia(this.integraciones, run.organizationId, canal, numero, 'document', node.data.documentUrl, node.data.filename, caption);
          await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'DOCUMENTO', contenido: node.data.filename || caption || 'Documento', remoteId: r?.remoteId });
          currentId = this.siguiente(definicion, node.id);
          break;
        }
        case 'buttons': {
          const opciones: Opcion[] = node.data.buttons.map((b, i) => ({ id: `btn${i + 1}`, title: b.title }));
          const texto = interpolar(node.data.text, ctx);
          const r = await enviarOpciones(this.integraciones, run.organizationId, canal, numero, texto, opciones);
          await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: renderOpciones(texto, opciones), remoteId: r?.remoteId });
          await this.guardarEspera(run.id, node.id, 'OPCION', opciones);
          return;
        }
        case 'delay': {
          const siguiente = this.siguiente(definicion, node.id);
          if (siguiente) {
            const segundos = Math.min(60, Math.max(1, node.data.seconds));
            setTimeout(() => { void this.continuarDespuesDeDelay(run.id, siguiente); }, segundos * 1000);
          }
          return;
        }
        case 'askInput': {
          const texto = interpolar(node.data.question, ctx);
          const r = await enviarTexto(this.integraciones, run.organizationId, canal, numero, texto);
          await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: texto, remoteId: r?.remoteId });
          await this.guardarEspera(run.id, node.id, 'INPUT', null);
          return;
        }
        case 'condition': {
          const key = node.data.variable.replace(/^vars\./, '');
          const valor = run.variables[key];
          const cumple =
            node.data.operator === 'exists' ? !!valor :
            node.data.operator === 'contains' ? !!valor && valor.toLowerCase().includes((node.data.value ?? '').toLowerCase()) :
            (valor ?? '').toLowerCase() === (node.data.value ?? '').toLowerCase();
          const edge = definicion.edges.find((e) => e.source === node.id && e.sourceHandle === (cumple ? 'yes' : 'no'));
          currentId = edge?.target;
          break;
        }
        case 'action': {
          if (node.data.handoffMessage) {
            const texto = interpolar(node.data.handoffMessage, ctx);
            const r = await enviarTexto(this.integraciones, run.organizationId, canal, numero, texto);
            await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: texto, remoteId: r?.remoteId });
          }
          await this.prisma.conversacion.update({ where: { id: run.conversacionId }, data: { botPausado: true, estado: 'PENDIENTE' } });
          if (node.data.notifyPhone) {
            // Por el mismo canal oficial. Ojo: Meta solo entrega texto libre a ese número si
            // escribió en las últimas 24 h; si no, el aviso no llega (no rompe el flujo).
            void enviarTexto(this.integraciones, run.organizationId, canal, node.data.notifyPhone, `Un cliente necesita atención: ${conversacion.contactoNombre || numero}`).catch(() => null);
          }
          await this.finalizarRun(run.id);
          return;
        }
        case 'scheduleBooking': {
          const slots = await calcularSlotsDisponibles(this.prisma, run.organizationId, node.data);
          if (slots.length === 0) {
            const texto = 'No tengo horarios disponibles por ahora. Un asesor te va a contactar pronto.';
            const r = await enviarTexto(this.integraciones, run.organizationId, canal, numero, texto);
            await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: texto, remoteId: r?.remoteId });
            await this.finalizarRun(run.id);
            return;
          }
          const opciones: Opcion[] = slots.map((s) => ({ id: s.toISOString(), title: formatearSlot(s) }));
          const texto = 'Elige un horario:';
          const r = await enviarOpciones(this.integraciones, run.organizationId, canal, numero, texto, opciones);
          await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: renderOpciones(texto, opciones), remoteId: r?.remoteId });
          await this.guardarEspera(run.id, node.id, 'AGENDA', opciones);
          return;
        }
        case 'end':
        default:
          return this.finalizarRun(run.id);
      }
    }
    await this.finalizarRun(run.id);
  }

  private async resolverEspera(run: RunState, definicion: FlowDefinition, conversacion: ConversacionCtx, contenido: string): Promise<void> {
    const node = definicion.nodes.find((n) => n.id === run.nodoActualId);
    if (!node) return this.finalizarRun(run.id);

    if (run.esperando === 'INPUT' && node.type === 'askInput') {
      if (!validarEntrada(node.data.validation, contenido)) {
        return this.reintentar(run, conversacion, node.data.retryMessage || node.data.question);
      }
      const variables = { ...run.variables, [node.data.saveAs]: contenido.trim() };
      await this.actualizarRun(run.id, { variables, esperando: null, opcionesPendientes: null, reintentos: 0 });
      const siguiente = this.siguiente(definicion, node.id);
      if (!siguiente) return this.finalizarRun(run.id);
      return this.avanzar({ ...run, variables }, definicion, conversacion, siguiente);
    }

    if (run.esperando === 'OPCION' && node.type === 'buttons') {
      const opciones = run.opcionesPendientes ?? [];
      const matchId = matchOpcion(contenido, opciones);
      if (!matchId) return this.reintentar(run, conversacion, 'No entendí tu elección. Por favor escribe el número de una opción.');

      const edge = definicion.edges.find((e) => e.source === node.id && e.sourceHandle === matchId)
        ?? definicion.edges.find((e) => e.source === node.id && e.sourceHandle === 'fallback');
      await this.actualizarRun(run.id, { esperando: null, opcionesPendientes: null, reintentos: 0 });
      if (!edge) return this.finalizarRun(run.id);
      return this.avanzar(run, definicion, conversacion, edge.target);
    }

    if (run.esperando === 'AGENDA' && node.type === 'scheduleBooking') {
      const opciones = run.opcionesPendientes ?? [];
      const matchId = matchOpcion(contenido, opciones);
      if (!matchId) return this.reintentar(run, conversacion, 'No entendí el horario. Por favor escribe el número de una opción.');

      const inicio = new Date(matchId);
      const vencimiento = new Date(inicio.getTime() + node.data.duracionMinutos * 60_000);
      await this.prisma.actividad.create({
        data: {
          organizationId: run.organizationId, tipo: 'REUNION', asunto: node.data.titulo,
          inicio, vencimiento, conversacionId: run.conversacionId,
          clienteId: conversacion.clienteId, leadId: conversacion.leadId,
        },
      });
      void this.notificaciones.crear(run.organizationId, 'CITA_AGENDADA', `Nueva cita agendada: ${node.data.titulo}`, formatearSlot(inicio), '/calendario');

      const textoConfirmacion = interpolar(
        node.data.mensajeConfirmacion || `¡Listo! Quedaste agendado para ${formatearSlot(inicio)}.`,
        { nombre: conversacion.contactoNombre ?? '', numero: conversacion.contactoId, variables: run.variables },
      );
      const r = await enviarTexto(this.integraciones, run.organizationId, conversacion.canal, conversacion.contactoId, textoConfirmacion);
      await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: textoConfirmacion, remoteId: r?.remoteId });

      await this.actualizarRun(run.id, { esperando: null, opcionesPendientes: null, reintentos: 0 });
      const siguiente = this.siguiente(definicion, node.id);
      if (!siguiente) return this.finalizarRun(run.id);
      return this.avanzar(run, definicion, conversacion, siguiente);
    }

    // El nodo actual ya no coincide con lo que la ejecución esperaba (flujo editado a medio
    // camino, por ejemplo) — se abandona en vez de quedar en un estado inconsistente.
    return this.finalizarRun(run.id);
  }

  private async continuarDespuesDeDelay(runId: string, nodeId: string): Promise<void> {
    try {
      const row = await this.prisma.botFlowRun.findUnique({ where: { id: runId } });
      if (!row || !row.activa) return;
      const conversacion = await this.prisma.conversacion.findUnique({ where: { id: row.conversacionId } });
      if (!conversacion || conversacion.botPausado) return;
      const bot = await this.prisma.botFlow.findUnique({ where: { id: row.botFlowId } });
      if (!bot) return;
      const definicion = bot.definicion as unknown as FlowDefinition;
      await this.avanzar(this.aEstado(row), definicion, conversacion, nodeId);
    } catch {
      // best-effort — un timer perdido no debe tumbar el proceso
    }
  }

  private async reintentar(run: RunState, conversacion: ConversacionCtx, mensaje: string): Promise<void> {
    if (run.reintentos + 1 >= MAX_REINTENTOS) return this.finalizarRun(run.id);
    const r = await enviarTexto(this.integraciones, run.organizationId, conversacion.canal, conversacion.contactoId, mensaje);
    await guardarMensajeSaliente(this.prisma, { conversacionId: run.conversacionId, tipo: 'TEXTO', contenido: mensaje, remoteId: r?.remoteId });
    await this.actualizarRun(run.id, { reintentos: run.reintentos + 1 });
  }

  private siguiente(definicion: FlowDefinition, nodeId: string): string | undefined {
    return definicion.edges.find((e) => e.source === nodeId)?.target;
  }

  private async crearOReiniciarRun(organizationId: string, conversacionId: string, botFlowId: string): Promise<RunState> {
    const row = await this.prisma.botFlowRun.upsert({
      where: { conversacionId },
      create: { organizationId, conversacionId, botFlowId, activa: true },
      update: { botFlowId, nodoActualId: null, esperando: null, variables: {}, opcionesPendientes: Prisma.JsonNull, reintentos: 0, activa: true },
    });
    return this.aEstado(row);
  }

  private aEstado(row: RunRow): RunState {
    return {
      id: row.id, organizationId: row.organizationId, conversacionId: row.conversacionId, botFlowId: row.botFlowId,
      nodoActualId: row.nodoActualId, esperando: row.esperando as Espera,
      variables: (row.variables as Variables) ?? {},
      opcionesPendientes: (row.opcionesPendientes as Opcion[] | null) ?? null,
      reintentos: row.reintentos,
    };
  }

  /** Convierte el `null` de dominio al `Prisma.JsonNull` que exige un campo `Json?` — Prisma
   * distingue "no tocar el campo" (`undefined`) de "guardar SQL NULL" (`Prisma.JsonNull`). */
  private jsonOpciones(opciones: Opcion[] | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (opciones === undefined) return undefined;
    return opciones === null ? Prisma.JsonNull : (opciones as unknown as Prisma.InputJsonValue);
  }

  private async guardarEspera(runId: string, nodeId: string, esperando: Exclude<Espera, null>, opciones: Opcion[] | null): Promise<void> {
    await this.prisma.botFlowRun.update({
      where: { id: runId },
      data: { nodoActualId: nodeId, esperando, opcionesPendientes: this.jsonOpciones(opciones), reintentos: 0 },
    });
  }

  private async actualizarRun(runId: string, data: Partial<{ variables: Variables; esperando: Espera; opcionesPendientes: Opcion[] | null; reintentos: number }>): Promise<void> {
    await this.prisma.botFlowRun.update({
      where: { id: runId },
      data: { ...data, opcionesPendientes: this.jsonOpciones(data.opcionesPendientes) },
    });
  }

  private async finalizarRun(runId: string): Promise<void> {
    await this.prisma.botFlowRun.update({
      where: { id: runId },
      data: { activa: false, nodoActualId: null, esperando: null, opcionesPendientes: Prisma.JsonNull },
    }).catch(() => {});
  }
}

function interpolar(texto: string, ctx: { nombre: string; numero: string; variables: Variables }): string {
  return texto
    .replace(/\{\{contact\.firstName\}\}/g, ctx.nombre.split(' ')[0] || '')
    .replace(/\{\{contact\.name\}\}/g, ctx.nombre)
    .replace(/\{\{contact\.phone\}\}/g, ctx.numero)
    .replace(/\{\{contact\.email\}\}/g, '')
    .replace(/\{\{vars\.([a-zA-Z0-9_]+)\}\}/g, (_, k: string) => ctx.variables[k] ?? '');
}

function renderOpciones(texto: string, opciones: Opcion[]): string {
  return `${texto}\n\n${opciones.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`;
}

function validarEntrada(tipo: 'any' | 'email' | 'phone' | 'number', valor: string): boolean {
  const v = valor.trim();
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (tipo === 'phone') return /^\+?\d{7,15}$/.test(v.replace(/[\s-]/g, ''));
  if (tipo === 'number') return v.length > 0 && !Number.isNaN(Number(v));
  return v.length > 0;
}

function matchOpcion(contenido: string, opciones: Opcion[]): string | null {
  const texto = contenido.trim();
  const idx = Number(texto);
  if (Number.isInteger(idx) && idx >= 1 && idx <= opciones.length) return opciones[idx - 1].id;
  const lower = texto.toLowerCase();
  const exacto = opciones.find((o) => o.title.toLowerCase() === lower);
  if (exacto) return exacto.id;
  const parcial = lower.length > 2 ? opciones.find((o) => o.title.toLowerCase().includes(lower)) : undefined;
  return parcial?.id ?? null;
}

function formatearSlot(d: Date): string {
  return d.toLocaleString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
