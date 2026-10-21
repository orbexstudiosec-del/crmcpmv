import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MensajesService } from '../mensajes/mensajes.service';
import { IntegracionesService } from '../integraciones/integraciones.service';
import { enviarPlantillaMeta } from '../integraciones/meta-client';
import type { CampanaInput, ActualizarCampanaInput, CredencialesWhatsappApi } from '@totalcrm/shared';

const RETRASO_ENTRE_ENVIOS_MS = 1500; // evita ráfagas que Evolution/WhatsApp puedan marcar como spam

/** Reemplaza {{clave}} por su valor en `variables` — si la clave no está, deja el placeholder
 *  tal cual (mejor un {{typo}} visible en el mensaje que perderlo silenciosamente). */
function interpolarMensaje(plantilla: string, variables: Record<string, string>): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (match, clave: string) => (clave in variables ? variables[clave] : match));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface DestinatarioNuevo {
  nombre: string;
  telefono: string;
  variables?: Record<string, string>;
}

@Injectable()
export class CampanasService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CampanasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mensajes: MensajesService,
    private readonly integraciones: IntegracionesService,
  ) {}

  /** El envío corre en segundo plano dentro del proceso: si el API se reinicia a mitad de una
   *  campaña, esta quedaba en ENVIANDO para siempre (sin poder editarla, borrarla ni reenviarla).
   *  Al arrancar se retoman los destinatarios que quedaron PENDIENTE. */
  async onApplicationBootstrap() {
    const atascadas = await this.prisma.campana.findMany({ where: { estado: 'ENVIANDO' }, select: { id: true, organizationId: true } });
    for (const c of atascadas) {
      this.logger.warn(`Retomando el envío de la campaña ${c.id}, interrumpido por un reinicio.`);
      void this.procesarEnvio(c.organizationId, c.id);
    }
  }

  private async validarFormulario(organizationId: string, formularioLeadId?: string) {
    if (!formularioLeadId) return;
    const existe = await this.prisma.formularioLead.count({ where: { id: formularioLeadId, organizationId } });
    if (!existe) throw new BadRequestException('El formulario no existe en esta organización');
  }

  listar(organizationId: string) {
    return this.prisma.campana.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Detalle por destinatario de una campaña ya enviada (o en curso) — quién la recibió, a
   *  quién le falló y por qué. Es la base del historial/KPIs y de la exportación. */
  async listarDestinatarios(organizationId: string, campanaId: string) {
    const campana = await this.prisma.campana.findFirst({ where: { id: campanaId, organizationId } });
    if (!campana) throw new BadRequestException('La campaña no existe en esta organización');
    return this.prisma.campanaDestinatario.findMany({
      where: { campanaId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async crear(organizationId: string, input: CampanaInput) {
    await this.validarFormulario(organizationId, input.formularioLeadId);
    return this.prisma.campana.create({
      data: {
        organizationId,
        nombre: input.nombre,
        canal: input.canal,
        estado: input.programadaPara ? 'PROGRAMADA' : 'BORRADOR',
        programadaPara: input.programadaPara ? new Date(input.programadaPara) : null,
        mensaje: input.mensaje,
        publico: input.publico,
        formularioLeadId: input.formularioLeadId,
        canalWhatsapp: input.canalWhatsapp,
        plantillaMeta: input.plantillaMeta,
        plantillaMetaIdioma: input.plantillaMetaIdioma,
      },
    });
  }

  async actualizar(organizationId: string, id: string, input: ActualizarCampanaInput) {
    const campana = await this.prisma.campana.findFirst({ where: { id, organizationId } });
    if (!campana) throw new BadRequestException('La campaña no existe en esta organización');
    if (campana.estado === 'ENVIANDO') throw new BadRequestException('No se puede editar una campaña mientras se está enviando');
    // ENVIANDO solo lo pone enviar(): marcarlo a mano dejaba la campaña bloqueada sin envío real.
    if (input.estado === 'ENVIANDO') throw new BadRequestException('Usa la opción Enviar para enviar la campaña');
    await this.validarFormulario(organizationId, input.formularioLeadId);

    return this.prisma.campana.update({
      where: { id },
      data: {
        nombre: input.nombre,
        canal: input.canal,
        estado: input.estado,
        programadaPara: input.programadaPara === undefined ? undefined : input.programadaPara ? new Date(input.programadaPara) : null,
        enviadaEn: input.estado === 'ENVIADA' && campana.estado !== 'ENVIADA' ? new Date() : undefined,
        enviados: input.enviados,
        aperturas: input.aperturas,
        respuestas: input.respuestas,
        mensaje: input.mensaje,
        publico: input.publico,
        formularioLeadId: input.formularioLeadId,
        canalWhatsapp: input.canalWhatsapp,
        plantillaMeta: input.plantillaMeta,
        plantillaMetaIdioma: input.plantillaMetaIdioma,
      },
    });
  }

  /** Arma la lista de destinatarios (snapshot — no cambia si el público se edita después),
   *  la guarda y dispara el envío en segundo plano. Responde apenas queda en ENVIANDO; el
   *  progreso real se sigue consultando con listar()/obtener(). */
  async enviar(organizationId: string, id: string) {
    const campana = await this.prisma.campana.findFirst({ where: { id, organizationId } });
    if (!campana) throw new BadRequestException('La campaña no existe en esta organización');
    if (campana.canal !== 'WHATSAPP') throw new BadRequestException('Por ahora solo se pueden enviar campañas de WhatsApp');
    if (!campana.publico) throw new BadRequestException('Falta el público de la campaña');
    if (campana.estado === 'ENVIANDO') throw new BadRequestException('Esta campaña ya se está enviando');
    if (campana.publico === 'LEADS_FORMULARIO' && !campana.formularioLeadId) {
      throw new BadRequestException('El formulario que usaba esta campaña como público ya no existe — elige otro público');
    }

    const canalWhatsapp = campana.canalWhatsapp ?? 'WHATSAPP_QR';
    if (canalWhatsapp === 'WHATSAPP_API' && !campana.plantillaMeta) {
      throw new BadRequestException('Falta el nombre de la plantilla aprobada en Meta');
    }
    if (canalWhatsapp === 'WHATSAPP_QR' && !campana.mensaje) {
      throw new BadRequestException('Falta el mensaje de la campaña');
    }

    const conectado = await this.integraciones.credencialesDescifradas(organizationId, canalWhatsapp);
    if (!conectado) {
      const nombreCanal = canalWhatsapp === 'WHATSAPP_API' ? 'WhatsApp (API oficial)' : 'WhatsApp (código QR)';
      throw new BadRequestException(`Conecta ${nombreCanal} en Configuración antes de enviar campañas.`);
    }

    const destinatarios = await this.armarDestinatarios(organizationId, campana.publico, campana.formularioLeadId);
    if (destinatarios.length === 0) {
      throw new BadRequestException(`No hay ${this.publicoLabel(campana.publico)} con teléfono registrado para enviar`);
    }

    // Se "toma" la campaña de forma atómica: dos clics (o dos pestañas) seguidos pasaban ambos
    // la comprobación de arriba y la mandaban dos veces a cada destinatario.
    const tomada = await this.prisma.campana.updateMany({ where: { id, organizationId, estado: { not: 'ENVIANDO' } }, data: { estado: 'ENVIANDO' } });
    if (tomada.count === 0) throw new BadRequestException('Esta campaña ya se está enviando');

    await this.prisma.$transaction([
      this.prisma.campanaDestinatario.deleteMany({ where: { campanaId: id } }), // por si se reintenta un envío previo
      this.prisma.campanaDestinatario.createMany({
        data: destinatarios.map((d) => ({ campanaId: id, nombre: d.nombre, telefono: d.telefono, variables: d.variables ?? undefined })),
      }),
      this.prisma.campana.update({
        where: { id },
        data: { estado: 'ENVIANDO', totalDestinatarios: destinatarios.length, enviados: 0, enviadaEn: null },
      }),
    ]);

    void this.procesarEnvio(organizationId, id);

    return this.prisma.campana.findUniqueOrThrow({ where: { id } });
  }

  private publicoLabel(publico: string): string {
    if (publico === 'CLIENTES') return 'clientes';
    if (publico === 'LEADS') return 'leads';
    return 'leads de este formulario';
  }

  private async armarDestinatarios(organizationId: string, publico: string, formularioLeadId?: string | null): Promise<DestinatarioNuevo[]> {
    if (publico === 'CLIENTES') {
      const registros = await this.prisma.cliente.findMany({
        where: { organizationId, telefono: { not: null } },
        select: { razonSocial: true, telefono: true },
      });
      return registros
        .map((r) => ({ nombre: r.razonSocial, telefono: (r.telefono ?? '').trim() }))
        .filter((d) => d.telefono !== '');
    }

    if (publico === 'LEADS') {
      const registros = await this.prisma.lead.findMany({
        where: { organizationId, telefono: { not: null } },
        select: { nombre: true, telefono: true },
      });
      return registros
        .map((r) => ({ nombre: r.nombre, telefono: (r.telefono ?? '').trim() }))
        .filter((d) => d.telefono !== '');
    }

    if (!formularioLeadId) return [];
    const registros = await this.prisma.lead.findMany({
      where: { organizationId, formularioId: formularioLeadId, telefono: { not: null } },
      select: { nombre: true, telefono: true },
    });
    return registros
      .map((r) => ({ nombre: r.nombre, telefono: (r.telefono ?? '').trim() }))
      .filter((d) => d.telefono !== '');
  }

  /** Envía uno por uno con una pausa entre cada mensaje — nunca corre en paralelo, para no
   *  disparar todos los mensajes de golpe desde el mismo número de WhatsApp. Cada destinatario
   *  queda marcado ENVIADO o ERROR (con el motivo) sin que una falla frene al resto del lote. */
  private async procesarEnvio(organizationId: string, campanaId: string): Promise<void> {
    const campana = await this.prisma.campana.findUnique({ where: { id: campanaId } });
    if (!campana) return;
    const canalWhatsapp = campana.canalWhatsapp ?? 'WHATSAPP_QR';
    if (canalWhatsapp === 'WHATSAPP_QR' && !campana.mensaje) return;
    if (canalWhatsapp === 'WHATSAPP_API' && !campana.plantillaMeta) return;

    // Credenciales de Meta se resuelven una sola vez para todo el lote (no por destinatario).
    const credencialesMeta =
      canalWhatsapp === 'WHATSAPP_API'
        ? ((await this.integraciones.credencialesDescifradas(organizationId, 'WHATSAPP_API')) as CredencialesWhatsappApi | null)
        : null;
    if (canalWhatsapp === 'WHATSAPP_API' && !credencialesMeta) return; // se desconectó entre el enviar() y este punto

    const pendientes = await this.prisma.campanaDestinatario.findMany({ where: { campanaId, estado: 'PENDIENTE' } });
    let enviados = 0;

    for (const destinatario of pendientes) {
      try {
        const primerNombre = destinatario.nombre.trim().split(/\s+/)[0] || destinatario.nombre;

        if (canalWhatsapp === 'WHATSAPP_API') {
          // Envío por plantilla oficial de Meta — no pasa por el inbox unificado de Mensajes
          // (sería un broadcast sin hilo de conversación real; ver nota de alcance en el plan).
          await enviarPlantillaMeta(credencialesMeta!, destinatario.telefono, campana.plantillaMeta!, campana.plantillaMetaIdioma ?? 'es', [primerNombre]);
        } else {
          const variables = { nombre: primerNombre, ...((destinatario.variables as Record<string, string> | null) ?? {}) };
          const texto = interpolarMensaje(campana.mensaje!, variables);
          const conversacion = await this.mensajes.iniciarConversacion(organizationId, destinatario.telefono);
          await this.mensajes.enviarMensaje(organizationId, conversacion.id, texto);
        }

        await this.prisma.campanaDestinatario.update({ where: { id: destinatario.id }, data: { estado: 'ENVIADO', enviadoEn: new Date() } });
        enviados++;
      } catch (err) {
        await this.prisma.campanaDestinatario.update({
          where: { id: destinatario.id },
          data: { estado: 'ERROR', error: err instanceof Error ? err.message : 'Error desconocido' },
        });
      }
      await this.prisma.campana.update({ where: { id: campanaId }, data: { enviados } });
      await sleep(RETRASO_ENTRE_ENVIOS_MS);
    }

    await this.prisma.campana.update({ where: { id: campanaId }, data: { estado: 'ENVIADA', enviadaEn: new Date() } });
  }

  async eliminar(organizationId: string, id: string) {
    const campana = await this.prisma.campana.findFirst({ where: { id, organizationId } });
    if (!campana) throw new BadRequestException('La campaña no existe en esta organización');
    if (campana.estado === 'ENVIANDO') throw new BadRequestException('No se puede eliminar una campaña mientras se está enviando');
    await this.prisma.campana.delete({ where: { id } });
    return { ok: true };
  }

}
