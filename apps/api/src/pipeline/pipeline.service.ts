import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  LeadInput, ActualizarLeadInput, ConvertirLeadInput,
  OportunidadInput, ActualizarOportunidadInput,
  ActividadInput, ActualizarActividadInput,
} from '@totalcrm/shared';
import { Prisma } from '@totalcrm/db';
import { etapaPipelineValida, primeraEtapaPipeline } from '../common/etapa-pipeline';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { agenciaDelMiembro, ciudadesConAgencia, normalizarCiudad, sucursalParaCiudad } from '../common/enrutamiento';

const LEAD_INCLUDE = { sucursal: { select: { id: true, nombre: true, ciudad: true } } };

const OPORTUNIDAD_INCLUDE = {
  cliente: { select: { id: true, razonSocial: true } },
  lead: { select: { id: true, nombre: true } },
};

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  // ── Leads ────────────────────────────────────────────────────

  /** Busca un prospecto respetando el alcance del miembro: quien está limitado a una agencia
   *  no puede abrir, editar ni borrar los de otra aunque conozca el id. */
  private async leadVisible(organizationId: string, id: string, membershipId?: string | null) {
    const agencia = await agenciaDelMiembro(this.prisma, membershipId ?? null);
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId, ...(agencia ? { sucursalId: agencia } : {}) } });
    if (!lead) throw new BadRequestException('El lead no existe en esta organización');
    return { lead, agencia };
  }

  private async validarSucursal(organizationId: string, sucursalId: string) {
    const sucursal = await this.prisma.sucursal.findFirst({ where: { id: sucursalId, organizationId }, select: { id: true } });
    if (!sucursal) throw new BadRequestException('La agencia no existe en esta organización');
  }

  /** Los agentes y supervisores de una agencia solo reciben los prospectos de su agencia; el
   *  resto (administradores, gerencia) ve todos, incluidos los que quedaron sin agencia. */
  async listarLeads(organizationId: string, membershipId?: string | null) {
    const agencia = await agenciaDelMiembro(this.prisma, membershipId ?? null);
    return this.prisma.lead.findMany({
      where: { organizationId, ...(agencia ? { sucursalId: agencia } : {}) },
      include: LEAD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  ciudadesConAgencia(organizationId: string) {
    return ciudadesConAgencia(this.prisma, organizationId);
  }

  async crearLead(organizationId: string, input: LeadInput) {
    const { sucursalId: elegida, ...datos } = input;
    if (elegida) await this.validarSucursal(organizationId, elegida);
    const sucursalId = elegida ?? (await sucursalParaCiudad(this.prisma, organizationId, input.ciudad));

    const lead = await this.prisma.lead.create({ data: { organizationId, ...datos, sucursalId }, include: LEAD_INCLUDE });
    void this.notificaciones.crear(
      organizationId, 'LEAD_NUEVO', `Nuevo lead: ${lead.nombre}`,
      lead.sucursal ? `Enviado a ${lead.sucursal.nombre}` : (lead.fuente ?? undefined), '/leads',
    );
    return lead;
  }

  /** La agencia se vuelve a calcular cuando cambia la ciudad, salvo que en la misma edición
   *  se haya elegido una a mano (ese valor manda, incluido "sin agencia"). */
  async actualizarLead(organizationId: string, id: string, input: ActualizarLeadInput, membershipId?: string | null) {
    const { lead, agencia } = await this.leadVisible(organizationId, id, membershipId);
    const { sucursalId: elegida, ...datos } = input;

    let sucursalId: string | null | undefined;
    if (elegida !== undefined) {
      if (agencia && elegida !== agencia) throw new BadRequestException('Solo un administrador puede pasar un prospecto a otra agencia');
      if (elegida) await this.validarSucursal(organizationId, elegida);
      sucursalId = elegida;
    } else if (input.ciudad !== undefined && normalizarCiudad(input.ciudad) !== normalizarCiudad(lead.ciudad)) {
      sucursalId = await sucursalParaCiudad(this.prisma, organizationId, input.ciudad);
    }

    return this.prisma.lead.update({ where: { id }, data: { ...datos, sucursalId }, include: LEAD_INCLUDE });
  }

  async eliminarLead(organizationId: string, id: string, membershipId?: string | null) {
    await this.leadVisible(organizationId, id, membershipId);
    await this.prisma.lead.delete({ where: { id } });
    return { ok: true };
  }
  async convertirLead(organizationId: string, id: string, input: ConvertirLeadInput, membershipId?: string | null) {
    const { lead } = await this.leadVisible(organizationId, id, membershipId);
    if (lead.estado === 'CONVERTIDO') throw new BadRequestException('Este lead ya fue convertido');
    const etapaInicial = await primeraEtapaPipeline(this.prisma, organizationId);

    const [, oportunidad] = await this.prisma.$transaction([
      this.prisma.lead.update({ where: { id }, data: { estado: 'CONVERTIDO' } }),
      this.prisma.oportunidad.create({
        data: {
          organizationId,
          leadId: id,
          titulo: input.titulo?.trim() || lead.nombre,
          etapa: etapaInicial,
          monto: new Prisma.Decimal(input.monto ?? 0),
          probabilidad: input.probabilidad ?? 0,
          cierreEstimado: input.cierreEstimado ? new Date(input.cierreEstimado) : null,
        },
        include: OPORTUNIDAD_INCLUDE,
      }),
    ]);
    void this.notificaciones.crear(organizationId, 'LEAD_CONVERTIDO', `"${lead.nombre}" se convirtió en oportunidad`, oportunidad.titulo, '/oportunidades');
    return oportunidad;
  }

  // ── Oportunidades ────────────────────────────────────────────
  listarOportunidades(organizationId: string) {
    return this.prisma.oportunidad.findMany({
      where: { organizationId },
      include: OPORTUNIDAD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async crearOportunidad(organizationId: string, input: OportunidadInput) {
    if (input.clienteId) {
      const cliente = await this.prisma.cliente.findFirst({ where: { id: input.clienteId, organizationId } });
      if (!cliente) throw new BadRequestException('El cliente no existe en esta organización');
    }
    if (input.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: input.leadId, organizationId } });
      if (!lead) throw new BadRequestException('El lead no existe en esta organización');
    }
    const etapaInicial = await primeraEtapaPipeline(this.prisma, organizationId);
    return this.prisma.oportunidad.create({
      data: {
        organizationId,
        titulo: input.titulo,
        clienteId: input.clienteId ?? null,
        leadId: input.leadId ?? null,
        etapa: etapaInicial,
        monto: new Prisma.Decimal(input.monto),
        probabilidad: input.probabilidad,
        cierreEstimado: input.cierreEstimado ? new Date(input.cierreEstimado) : null,
      },
      include: OPORTUNIDAD_INCLUDE,
    });
  }

  async actualizarOportunidad(organizationId: string, id: string, input: ActualizarOportunidadInput) {
    const oportunidad = await this.prisma.oportunidad.findFirst({ where: { id, organizationId } });
    if (!oportunidad) throw new BadRequestException('La oportunidad no existe en esta organización');
    if (input.etapa && !(await etapaPipelineValida(this.prisma, organizationId, input.etapa))) {
      throw new BadRequestException('Esa etapa no existe en este workspace');
    }

    return this.prisma.oportunidad.update({
      where: { id },
      data: {
        titulo: input.titulo,
        etapa: input.etapa,
        monto: input.monto === undefined ? undefined : new Prisma.Decimal(input.monto),
        probabilidad: input.probabilidad,
        cierreEstimado:
          input.cierreEstimado === undefined ? undefined : input.cierreEstimado ? new Date(input.cierreEstimado) : null,
      },
      include: OPORTUNIDAD_INCLUDE,
    });
  }

  async eliminarOportunidad(organizationId: string, id: string) {
    const oportunidad = await this.prisma.oportunidad.findFirst({ where: { id, organizationId } });
    if (!oportunidad) throw new BadRequestException('La oportunidad no existe en esta organización');
    await this.prisma.oportunidad.delete({ where: { id } });
    return { ok: true };
  }

  // ── Actividades ──────────────────────────────────────────────
  listarActividades(organizationId: string, filtros: { leadId?: string; clienteId?: string; oportunidadId?: string; conversacionId?: string; pendientes?: boolean }) {
    return this.prisma.actividad.findMany({
      where: {
        organizationId,
        leadId: filtros.leadId,
        clienteId: filtros.clienteId,
        oportunidadId: filtros.oportunidadId,
        conversacionId: filtros.conversacionId,
        completada: filtros.pendientes ? false : undefined,
      },
      orderBy: [{ completada: 'asc' }, { vencimiento: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** Los ids a los que se vincula una actividad llegan del cliente: sin comprobarlos, se podía
   *  colgar una actividad de un lead, cliente u oportunidad de OTRA organización (la base solo
   *  verifica que el id exista, no de quién es). */
  private async validarVinculosActividad(organizationId: string, v: { clienteId?: string | null; oportunidadId?: string | null; leadId?: string | null; conversacionId?: string | null }) {
    const where = { organizationId };
    const [cliente, oportunidad, lead, conversacion] = await Promise.all([
      v.clienteId ? this.prisma.cliente.count({ where: { ...where, id: v.clienteId } }) : 1,
      v.oportunidadId ? this.prisma.oportunidad.count({ where: { ...where, id: v.oportunidadId } }) : 1,
      v.leadId ? this.prisma.lead.count({ where: { ...where, id: v.leadId } }) : 1,
      v.conversacionId ? this.prisma.conversacion.count({ where: { ...where, id: v.conversacionId } }) : 1,
    ]);
    if (!cliente) throw new BadRequestException('El cliente no existe en esta organización');
    if (!oportunidad) throw new BadRequestException('La oportunidad no existe en esta organización');
    if (!lead) throw new BadRequestException('El lead no existe en esta organización');
    if (!conversacion) throw new BadRequestException('La conversación no existe en esta organización');
  }

  async crearActividad(organizationId: string, input: ActividadInput, membershipId?: string | null) {
    await this.validarVinculosActividad(organizationId, input);
    return this.prisma.actividad.create({
      data: {
        organizationId,
        tipo: input.tipo,
        asunto: input.asunto,
        detalle: input.detalle,
        inicio: input.inicio ? new Date(input.inicio) : null,
        vencimiento: input.vencimiento ? new Date(input.vencimiento) : null,
        clienteId: input.clienteId ?? null,
        oportunidadId: input.oportunidadId ?? null,
        leadId: input.leadId ?? null,
        conversacionId: input.conversacionId ?? null,
        // Quién registró la actividad (para atribuir llamadas/notas/tareas por asesor).
        realizadoPorId: membershipId ?? null,
      },
    });
  }

  async actualizarActividad(organizationId: string, id: string, input: ActualizarActividadInput) {
    const actividad = await this.prisma.actividad.findFirst({ where: { id, organizationId } });
    if (!actividad) throw new BadRequestException('La actividad no existe en esta organización');
    await this.validarVinculosActividad(organizationId, input);
    const { inicio, vencimiento, clienteId, oportunidadId, leadId, conversacionId, ...resto } = input;
    return this.prisma.actividad.update({
      where: { id },
      data: {
        ...resto,
        ...(inicio !== undefined ? { inicio: inicio ? new Date(inicio) : null } : {}),
        ...(vencimiento !== undefined ? { vencimiento: vencimiento ? new Date(vencimiento) : null } : {}),
        ...(clienteId !== undefined ? { clienteId: clienteId || null } : {}),
        ...(oportunidadId !== undefined ? { oportunidadId: oportunidadId || null } : {}),
        ...(leadId !== undefined ? { leadId: leadId || null } : {}),
        ...(conversacionId !== undefined ? { conversacionId: conversacionId || null } : {}),
      },
    });
  }

  async eliminarActividad(organizationId: string, id: string) {
    const actividad = await this.prisma.actividad.findFirst({ where: { id, organizationId } });
    if (!actividad) throw new BadRequestException('La actividad no existe en esta organización');
    await this.prisma.actividad.delete({ where: { id } });
    return { ok: true };
  }

}
