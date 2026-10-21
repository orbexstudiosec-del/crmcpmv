import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { formularioLeadEnvioSchema } from '@totalcrm/shared';
import type { FormularioLeadInput } from '@totalcrm/shared';
import { Prisma } from '@totalcrm/db';
import { ciudadesConAgencia, sucursalParaCiudad } from '../common/enrutamiento';

/** Minúsculas, sin acentos, solo [a-z0-9-] — la parte "linda" del slug antes del sufijo random. */
function slugBase(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos/diacríticos tras normalizar NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return limpio || 'formulario';
}

const CAMPOS_INCLUDE = { campos: { orderBy: { orden: 'asc' as const } } };

@Injectable()
export class FormulariosLeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  listar(organizationId: string) {
    return this.prisma.formularioLead.findMany({
      where: { organizationId },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtener(organizationId: string, id: string) {
    const formulario = await this.prisma.formularioLead.findFirst({ where: { id, organizationId }, include: CAMPOS_INCLUDE });
    if (!formulario) throw new BadRequestException('El formulario no existe en esta organización');
    return formulario;
  }

  /** Reintenta unas pocas veces ante colisión — con 3 bytes random (16M combinaciones) por
   *  organización es prácticamente imposible, pero el @unique de todas formas lo garantiza. */
  private async generarSlug(nombre: string): Promise<string> {
    const base = slugBase(nombre);
    for (let intento = 0; intento < 5; intento++) {
      const slug = `${base}-${randomBytes(3).toString('hex')}`;
      const existe = await this.prisma.formularioLead.findUnique({ where: { slug }, select: { id: true } });
      if (!existe) return slug;
    }
    throw new BadRequestException('No se pudo generar un link único, intenta de nuevo');
  }

  private camposData(input: FormularioLeadInput) {
    return input.campos.map((c, i) => ({
      orden: i,
      tipo: c.tipo,
      etiqueta: c.etiqueta,
      obligatorio: c.obligatorio,
      opciones: c.opciones ?? [],
      mapeaA: c.mapeaA,
    }));
  }

  async crear(organizationId: string, input: FormularioLeadInput) {
    const slug = await this.generarSlug(input.nombre);
    return this.prisma.formularioLead.create({
      data: {
        organizationId,
        nombre: input.nombre,
        slug,
        descripcion: input.descripcion,
        mensajeExito: input.mensajeExito,
        activo: input.activo ?? true,
        campos: { create: this.camposData(input) },
      },
      include: CAMPOS_INCLUDE,
    });
  }

  /** Reemplaza la lista de campos completa en vez de hacer diff campo por campo — el builder
   *  del frontend manda el array entero en cada guardado, no hay ids de campo persistentes
   *  entre ediciones (mismo criterio que Organization.pipelineEtapas, guardado como bloque). */
  async actualizar(organizationId: string, id: string, input: FormularioLeadInput) {
    const formulario = await this.prisma.formularioLead.findFirst({ where: { id, organizationId } });
    if (!formulario) throw new BadRequestException('El formulario no existe en esta organización');

    return this.prisma.$transaction(async (tx) => {
      await tx.formularioLeadCampo.deleteMany({ where: { formularioId: id } });
      return tx.formularioLead.update({
        where: { id },
        data: {
          nombre: input.nombre,
          descripcion: input.descripcion,
          mensajeExito: input.mensajeExito,
          activo: input.activo,
          campos: { create: this.camposData(input) },
        },
        include: CAMPOS_INCLUDE,
      });
    });
  }

  async eliminar(organizationId: string, id: string) {
    const formulario = await this.prisma.formularioLead.findFirst({ where: { id, organizationId } });
    if (!formulario) throw new BadRequestException('El formulario no existe en esta organización');
    await this.prisma.formularioLead.delete({ where: { id } });
    return { ok: true };
  }

  async leadsDelFormulario(organizationId: string, id: string) {
    const formulario = await this.prisma.formularioLead.findFirst({ where: { id, organizationId } });
    if (!formulario) throw new BadRequestException('El formulario no existe en esta organización');
    return this.prisma.lead.findMany({ where: { organizationId, formularioId: id }, orderBy: { createdAt: 'desc' } });
  }

  // ── Público (sin auth) ──────────────────────────────────────────────

  /** Solo lo necesario para renderizar el formulario público — nunca organizationId ni conteos. */
  async obtenerPublico(slug: string) {
    const formulario = await this.prisma.formularioLead.findUnique({ where: { slug }, include: CAMPOS_INCLUDE });
    if (!formulario || !formulario.activo) throw new BadRequestException('Este formulario ya no está disponible');
    const ciudades = await this.opcionesCiudad(formulario.organizationId, formulario.campos);
    return {
      nombre: formulario.nombre,
      descripcion: formulario.descripcion,
      mensajeExito: formulario.mensajeExito,
      campos: formulario.campos.map((c) => ({
        id: c.id,
        tipo: c.tipo,
        etiqueta: c.etiqueta,
        obligatorio: c.obligatorio,
        opciones: c.mapeaA === 'CIUDAD' && ciudades ? ciudades : c.opciones,
      })),
    };
  }

  /** La pregunta de ciudad ofrece siempre las ciudades que hoy cubre alguna agencia, no la
   *  lista que se guardó al armar el formulario: abrir o cerrar una agencia actualiza todos
   *  los formularios sin editarlos. null = el formulario no pregunta ciudad o aún no hay
   *  agencias con ciudad (se usan las opciones guardadas). */
  private async opcionesCiudad(organizationId: string, campos: { mapeaA: string | null }[]): Promise<string[] | null> {
    if (!campos.some((c) => c.mapeaA === 'CIUDAD')) return null;
    const ciudades = await ciudadesConAgencia(this.prisma, organizationId);
    return ciudades.length ? ciudades : null;
  }

  async enviarPublico(slug: string, body: unknown) {
    const input = formularioLeadEnvioSchema.parse(body);
    if (input._hp) return { ok: true }; // honeypot: un bot cayó, fingimos éxito sin crear nada

    const formulario = await this.prisma.formularioLead.findUnique({ where: { slug }, include: CAMPOS_INCLUDE });
    if (!formulario || !formulario.activo) throw new BadRequestException('Este formulario ya no está disponible');

    const ciudades = await this.opcionesCiudad(formulario.organizationId, formulario.campos);
    const respuestas = input.respuestas ?? {};
    const mapeadas: Record<string, string> = {};
    const libres: Record<string, { etiqueta: string; valor: string | string[] }> = {};

    for (const campo of formulario.campos) {
      const valor = respuestas[campo.id];
      const vacio = valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0);
      if (campo.obligatorio && vacio) throw new BadRequestException(`Falta responder "${campo.etiqueta}"`);
      if (valor === undefined) continue;

      if (campo.tipo === 'OPCION_UNICA' || campo.tipo === 'OPCION_MULTIPLE') {
        const valores = Array.isArray(valor) ? valor : [valor];
        const permitidas = campo.mapeaA === 'CIUDAD' && ciudades ? ciudades : campo.opciones;
        if (valores.some((v) => !permitidas.includes(v))) {
          throw new BadRequestException(`Respuesta inválida para "${campo.etiqueta}"`);
        }
      }

      if (campo.mapeaA) {
        mapeadas[campo.mapeaA.toLowerCase()] = Array.isArray(valor) ? valor.join(', ') : valor;
      } else {
        libres[campo.id] = { etiqueta: campo.etiqueta, valor };
      }
    }

    const sucursalId = await sucursalParaCiudad(this.prisma, formulario.organizationId, mapeadas.ciudad);
    const lead = await this.prisma.lead.create({
      data: {
        organizationId: formulario.organizationId,
        ciudad: mapeadas.ciudad,
        sucursalId,
        nombre: input.nombre,
        telefono: input.telefono,
        email: mapeadas.email,
        empresa: mapeadas.empresa,
        notas: mapeadas.notas,
        fuente: formulario.nombre,
        formularioId: formulario.id,
        respuestasFormulario: Object.keys(libres).length ? (libres as Prisma.InputJsonValue) : undefined,
      },
      include: { sucursal: { select: { nombre: true } } },
    });
    void this.notificaciones.crear(
      formulario.organizationId, 'LEAD_NUEVO', `Nuevo lead: ${lead.nombre}`,
      lead.sucursal ? `Enviado a ${lead.sucursal.nombre}` : formulario.nombre, '/leads',
    );
    return { ok: true };
  }
}
