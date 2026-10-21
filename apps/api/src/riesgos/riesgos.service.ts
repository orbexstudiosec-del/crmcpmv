import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MailService } from '../auth/mail.service';
import { agenciaDelMiembro } from '../common/enrutamiento';
import type { AnalisisRiesgoInput, RolMiembro } from '@totalcrm/shared';
import { Prisma } from '@totalcrm/db';

/** Quién puede analizar riesgo (evaluar/decidir): el equipo de riesgos y la administración. */
const ROLES_ANALISTA: RolMiembro[] = ['RIESGOS', 'ADMIN', 'OWNER'];

const LEAD_SELECT = {
  id: true, nombre: true, telefono: true, email: true, ciudad: true, estado: true,
  sucursal: { select: { id: true, nombre: true, ciudad: true } },
};
const ANALISIS_INCLUDE = {
  lead: { select: LEAD_SELECT },
  analizadoPor: { select: { id: true, user: { select: { nombre: true } } } },
};

const dec = (v: number | null | undefined) => (v === null || v === undefined ? null : new Prisma.Decimal(v));

@Injectable()
export class RiesgosService {
  private readonly logger = new Logger(RiesgosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
    private readonly mail: MailService,
  ) {}

  /** Prospectos calificados que todavía no tienen un análisis cerrado — la cola de trabajo del
   *  equipo de riesgos. Solo los que un asesor ya marcó como CALIFICADO llegan aquí. */
  async cola(organizationId: string, rol: RolMiembro, membershipId: string | null) {
    const alcance = await this.alcanceLeads(rol, membershipId);
    if (alcance === null) return [];
    return this.prisma.lead.findMany({
      where: {
        organizationId,
        ...alcance,
        estado: 'CALIFICADO',
        OR: [{ analisisRiesgo: null }, { analisisRiesgo: { estado: { in: ['PENDIENTE', 'EN_ANALISIS', 'OBSERVADO'] } } }],
      },
      select: { ...LEAD_SELECT, analisisRiesgo: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Lista de análisis según el rol:
   *  - equipo de riesgos / administración: todos.
   *  - jefe de agencia (SUPERVISOR) y agentes: solo los APROBADOS de su agencia (su bandeja).
   *  El filtro por agencia reusa la misma regla que el resto del CRM (enrutamiento.ts). */
  async listar(organizationId: string, rol: RolMiembro, membershipId: string | null, soloAprobados: boolean) {
    const esAnalista = ROLES_ANALISTA.includes(rol);
    const agencia = await agenciaDelMiembro(this.prisma, membershipId);

    const where: Prisma.AnalisisRiesgoWhereInput = { organizationId };
    if (soloAprobados || !esAnalista) where.estado = 'APROBADO';
    if (!esAnalista && agencia) where.lead = { sucursalId: agencia };
    // Un analista sin agencia ve todo; un jefe/agente de agencia solo lo aprobado de la suya.
    if (!esAnalista && !agencia && rol !== 'GERENCIA') return [];

    return this.prisma.analisisRiesgo.findMany({ where, include: ANALISIS_INCLUDE, orderBy: { updatedAt: 'desc' } });
  }

  /** Qué prospectos puede ver cada rol en este módulo: analistas y gerencia, todos; un jefe de
   *  agencia, solo los de su agencia (null = ninguno, si no tiene agencia asignada). Antes un
   *  SUPERVISOR podía abrir cualquier prospecto por id, con notas y respuestas incluidas. */
  private async alcanceLeads(rol: RolMiembro, membershipId: string | null): Promise<{ sucursalId?: string } | null> {
    if (ROLES_ANALISTA.includes(rol) || rol === 'GERENCIA') return {};
    const agencia = await agenciaDelMiembro(this.prisma, membershipId);
    return agencia ? { sucursalId: agencia } : null;
  }

  async obtener(organizationId: string, leadId: string, rol: RolMiembro, membershipId: string | null) {
    const alcance = await this.alcanceLeads(rol, membershipId);
    if (alcance === null) throw new BadRequestException('El prospecto no existe en esta organización');
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, ...alcance },
      select: { ...LEAD_SELECT, empresa: true, fuente: true, notas: true, respuestasFormulario: true, analisisRiesgo: { include: { analizadoPor: { select: { user: { select: { nombre: true } } } } } } },
    });
    if (!lead) throw new BadRequestException('El prospecto no existe en esta organización');
    return lead;
  }

  /** Guarda (crea o actualiza) el análisis de un prospecto. Solo el equipo de riesgos y la
   *  administración. Al aprobar, notifica al jefe de la agencia del prospecto. */
  async guardar(organizationId: string, leadId: string, rol: RolMiembro, membershipId: string | null, input: AnalisisRiesgoInput) {
    if (!ROLES_ANALISTA.includes(rol)) throw new ForbiddenException('Solo el equipo de riesgos puede analizar prospectos.');

    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId }, include: { sucursal: { select: { id: true, nombre: true } } } });
    if (!lead) throw new BadRequestException('El prospecto no existe en esta organización');
    if (input.estado === 'APROBADO' && !lead.sucursalId) {
      throw new BadRequestException('Este prospecto no tiene agencia asignada; asígnasela antes de aprobarlo para que llegue a un jefe de agencia.');
    }

    const cerrado = input.estado === 'APROBADO' || input.estado === 'RECHAZADO';
    const datos = {
      estado: input.estado,
      nivel: input.nivel ?? null,
      puntaje: input.puntaje ?? null,
      montoSolicitado: dec(input.montoSolicitado),
      montoAprobado: input.estado === 'APROBADO' ? dec(input.montoAprobado) : null,
      ingresos: dec(input.ingresos),
      egresos: dec(input.egresos),
      criterios: (input.criterios ?? undefined) as Prisma.InputJsonValue | undefined,
      observaciones: input.observaciones ?? null,
      analizadoPorId: membershipId,
      analizadoEn: cerrado ? new Date() : null,
    };

    const previo = await this.prisma.analisisRiesgo.findUnique({ where: { leadId }, select: { estado: true } });
    const analisis = await this.prisma.analisisRiesgo.upsert({
      where: { leadId },
      create: { organizationId, leadId, ...datos },
      update: datos,
      include: ANALISIS_INCLUDE,
    });

    // Avisar al jefe de agencia solo cuando el prospecto ACABA de aprobarse (no en cada reguardado).
    if (input.estado === 'APROBADO' && previo?.estado !== 'APROBADO') {
      void this.notificaciones.crear(
        organizationId, 'RIESGO_APROBADO',
        `Prospecto aprobado: ${lead.nombre}`,
        lead.sucursal ? `Listo para ${lead.sucursal.nombre}` : undefined,
        '/riesgos',
      );
      // Envío automático en lote: si esta agencia ya juntó el umbral de aprobados sin enviar,
      // sale el correo solo. No bloquea ni rompe la aprobación si el correo falla.
      if (lead.sucursalId) {
        this.enviarLoteSiLlegoAlUmbral(organizationId, lead.sucursalId).catch((e) =>
          this.logger.warn(`Envío automático de lote falló para la agencia ${lead.sucursalId}: ${e instanceof Error ? e.message : e}`));
      }
    }
    return analisis;
  }

  // ── Envío de lotes a los jefes de agencia ───────────────────────

  /** Correos de los jefes (SUPERVISOR) de una agencia — los destinatarios del lote. */
  private async jefesDeAgencia(organizationId: string, sucursalId: string): Promise<string[]> {
    const jefes = await this.prisma.membership.findMany({
      where: { organizationId, sucursalId, rol: 'SUPERVISOR' },
      select: { user: { select: { email: true } } },
    });
    return jefes.map((j) => j.user.email);
  }

  /** Cuántos prospectos aprobados están pendientes de enviar, agrupados por agencia, con cuántos
   *  jefes recibirían el correo. Es lo que ve el módulo para decidir si enviar ya o esperar. */
  async pendientesDeEnvio(organizationId: string) {
    const pendientes = await this.prisma.analisisRiesgo.findMany({
      where: { organizationId, estado: 'APROBADO', enviadoEn: null, lead: { sucursalId: { not: null } } },
      select: { lead: { select: { sucursalId: true, sucursal: { select: { nombre: true } } } } },
    });
    const porAgencia = new Map<string, { sucursalId: string; nombre: string; pendientes: number }>();
    for (const p of pendientes) {
      const id = p.lead.sucursalId!;
      const actual = porAgencia.get(id) ?? { sucursalId: id, nombre: p.lead.sucursal?.nombre ?? 'Agencia', pendientes: 0 };
      actual.pendientes++;
      porAgencia.set(id, actual);
    }
    const filas = await Promise.all([...porAgencia.values()].map(async (f) => ({
      ...f,
      jefes: (await this.jefesDeAgencia(organizationId, f.sucursalId)).length,
    })));
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { umbralLoteRiesgo: true } });
    return { umbral: org.umbralLoteRiesgo, smtp: this.mail.smtpConfigurado, agencias: filas.sort((a, b) => b.pendientes - a.pendientes) };
  }

  /** Dispara el envío automático de una agencia solo si alcanzó el umbral configurado. */
  private async enviarLoteSiLlegoAlUmbral(organizationId: string, sucursalId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { umbralLoteRiesgo: true } });
    const pendientes = await this.prisma.analisisRiesgo.count({ where: { organizationId, estado: 'APROBADO', enviadoEn: null, lead: { sucursalId } } });
    if (pendientes >= org.umbralLoteRiesgo) await this.enviarLoteDeAgencia(organizationId, sucursalId, 'automático');
  }

  /** Envía por correo los aprobados pendientes de UNA agencia al/los jefe(s) y los marca enviados.
   *  Devuelve cuántos se enviaron y a cuántos destinatarios (0 destinatarios = sin jefe asignado). */
  private async enviarLoteDeAgencia(organizationId: string, sucursalId: string, origen: 'manual' | 'automático') {
    const pendientes = await this.prisma.analisisRiesgo.findMany({
      where: { organizationId, estado: 'APROBADO', enviadoEn: null, lead: { sucursalId } },
      select: { id: true, nivel: true, montoAprobado: true, lead: { select: { nombre: true, telefono: true, ciudad: true, sucursal: { select: { nombre: true } } } } },
      orderBy: { analizadoEn: 'asc' },
    });
    if (pendientes.length === 0) return { enviados: 0, destinatarios: 0, agencia: '' };

    const agencia = pendientes[0].lead.sucursal?.nombre ?? 'Agencia';
    const destinatarios = await this.jefesDeAgencia(organizationId, sucursalId);
    if (destinatarios.length === 0) {
      this.logger.warn(`Agencia "${agencia}" tiene ${pendientes.length} aprobado(s) pero ningún jefe (SUPERVISOR) asignado: no se envió.`);
      return { enviados: 0, destinatarios: 0, agencia, sinJefe: true };
    }

    const enlace = `${(process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '')}/riesgos`;
    await this.mail.enviarLoteProspectos(
      destinatarios, agencia,
      pendientes.map((p) => ({ nombre: p.lead.nombre, telefono: p.lead.telefono, ciudad: p.lead.ciudad, montoAprobado: p.montoAprobado?.toString() ?? null, nivel: p.nivel })),
      enlace,
    );
    await this.prisma.analisisRiesgo.updateMany({ where: { id: { in: pendientes.map((p) => p.id) } }, data: { enviadoEn: new Date() } });
    this.logger.log(`Lote ${origen}: ${pendientes.length} prospecto(s) de "${agencia}" enviados a ${destinatarios.join(', ')}.`);
    return { enviados: pendientes.length, destinatarios: destinatarios.length, agencia };
  }

  /** Envío manual desde el módulo: una agencia concreta, o todas las que tengan pendientes. */
  async enviarLote(organizationId: string, rol: RolMiembro, sucursalId?: string) {
    if (!ROLES_ANALISTA.includes(rol)) throw new ForbiddenException('Solo el equipo de riesgos puede enviar los lotes.');

    let agencias: string[];
    if (sucursalId) {
      agencias = [sucursalId];
    } else {
      const pend = await this.prisma.analisisRiesgo.findMany({
        where: { organizationId, estado: 'APROBADO', enviadoEn: null, lead: { sucursalId: { not: null } } },
        select: { lead: { select: { sucursalId: true } } },
        distinct: ['leadId'],
      });
      agencias = [...new Set(pend.map((p) => p.lead.sucursalId!).filter(Boolean))];
    }

    const resultados = [];
    for (const ag of agencias) resultados.push(await this.enviarLoteDeAgencia(organizationId, ag, 'manual'));
    const enviados = resultados.reduce((s, r) => s + r.enviados, 0);
    const sinJefe = resultados.filter((r) => 'sinJefe' in r && r.sinJefe).map((r) => r.agencia);
    return { enviados, agencias: resultados.filter((r) => r.enviados > 0).length, sinJefe, smtp: this.mail.smtpConfigurado };
  }

  /** Métricas para la cabecera del módulo. */
  async resumen(organizationId: string) {
    const [enCola, aprobados, rechazados, observados, pendientesEnvio] = await Promise.all([
      this.prisma.lead.count({ where: { organizationId, estado: 'CALIFICADO', OR: [{ analisisRiesgo: null }, { analisisRiesgo: { estado: { in: ['PENDIENTE', 'EN_ANALISIS', 'OBSERVADO'] } } }] } }),
      this.prisma.analisisRiesgo.count({ where: { organizationId, estado: 'APROBADO' } }),
      this.prisma.analisisRiesgo.count({ where: { organizationId, estado: 'RECHAZADO' } }),
      this.prisma.analisisRiesgo.count({ where: { organizationId, estado: 'OBSERVADO' } }),
      this.prisma.analisisRiesgo.count({ where: { organizationId, estado: 'APROBADO', enviadoEn: null } }),
    ]);
    return { enCola, aprobados, rechazados, observados, pendientesEnvio };
  }
}
