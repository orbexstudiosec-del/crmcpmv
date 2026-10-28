import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { llamarChatJSON } from '../common/ai/openai-client';
import { IaService } from '../ia/ia.service';
import {
  redSocialSchema, tipoPiezaSchema,
  type ActualizarPublicacionInput, type ActualizarCategoriaCronopostInput, type CategoriaCronopostInput, type CronopostConfigInput, type DiaSemana, type GenerarCopyInput,
  type GenerarPlanInput, type PublicacionInput, type RedSocial, type TipoPieza, type TonoCopy,
} from '@totalcrm/shared';

const PUBLICACION_INCLUDE = {
  responsable: { select: { id: true, user: { select: { nombre: true } } } },
  categoria: { select: { id: true, nombre: true, color: true } },
};
const MAX_CATEGORIAS = 20;

const NOMBRE_RED: Record<RedSocial, string> = {
  FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', WHATSAPP: 'estados de WhatsApp',
  LINKEDIN: 'LinkedIn', YOUTUBE: 'YouTube', X: 'X (Twitter)',
};
/** Largo máximo del texto que acepta cada red; la IA escribe para la más restrictiva elegida. */
export const LIMITE_COPY: Record<RedSocial, number> = {
  FACEBOOK: 2200, INSTAGRAM: 2200, TIKTOK: 2200, WHATSAPP: 700, LINKEDIN: 3000, YOUTUBE: 5000, X: 280,
};
const TONO: Record<TonoCopy, string> = {
  CERCANO: 'cercano y cálido, como habla la cooperativa con sus socios',
  INFORMATIVO: 'claro e informativo, directo al punto',
  INSPIRADOR: 'inspirador y motivador',
  FORMAL: 'formal e institucional',
};
const DIA_JS: Record<DiaSemana, number> = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 };
const MAX_ESPACIOS = 40;

/** Configuración que se usa mientras la organización no guardó la suya. */
const CONFIG_INICIAL: CronopostConfigInput = {
  descripcion: null,
  publicoObjetivo: null,
  productos: null,
  tono: 'CERCANO',
  redes: ['FACEBOOK', 'INSTAGRAM'],
  publicacionesPorSemana: 3,
  dias: ['LUN', 'MIE', 'VIE'],
  horarios: ['10:00'],
  hashtagsFijos: null,
  restricciones: null,
};

const respuestaCopySchema = z.object({
  opciones: z.array(z.object({ copy: z.string().min(1), hashtags: z.string() })).min(1).max(5),
});
const respuestaPlanSchema = z.object({
  publicaciones: z.array(z.object({
    espacio: z.number().int(),
    tema: z.string().min(1).max(160),
    categoria: z.string(),
    tipo: tipoPiezaSchema,
    redes: z.array(redSocialSchema),
    copy: z.string().min(1),
    hashtags: z.string(),
  })),
});

const ESQUEMA_COPY = {
  type: 'object', additionalProperties: false, required: ['opciones'],
  properties: {
    opciones: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['copy', 'hashtags'], properties: { copy: { type: 'string' }, hashtags: { type: 'string' } } },
    },
  },
};
/** Esquema de la respuesta del plan: la categoría solo puede ser una de las elegidas. */
function esquemaPlan(categorias: string[]) {
  return {
    type: 'object', additionalProperties: false, required: ['publicaciones'],
    properties: {
      publicaciones: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['espacio', 'tema', 'categoria', 'tipo', 'redes', 'copy', 'hashtags'],
          properties: {
            espacio: { type: 'integer' },
            tema: { type: 'string' },
            categoria: { type: 'string', enum: categorias },
            tipo: { type: 'string', enum: tipoPiezaSchema.options },
            redes: { type: 'array', items: { type: 'string', enum: redSocialSchema.options } },
            copy: { type: 'string' },
            hashtags: { type: 'string' },
          },
        },
      },
    },
  };
}

/** Agrega los hashtags fijos de la marca a los que propuso la IA, sin repetir. */
function unirHashtags(propuestos: string, fijos?: string | null): string {
  const lista = [...(fijos ?? '').split(/\s+/), ...propuestos.split(/\s+/)]
    .map((h) => h.trim()).filter((h) => h.startsWith('#') && h.length > 1);
  return [...new Map(lista.map((h) => [h.toLowerCase(), h])).values()].join(' ');
}

const fechaLegible = (d: Date) =>
  d.toLocaleString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

@Injectable()
export class CronopostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
  ) {}

  // ── Publicaciones ────────────────────────────────────────────

  listar(organizationId: string, desde?: string, hasta?: string) {
    return this.prisma.publicacion.findMany({
      where: {
        organizationId,
        ...(desde || hasta ? { fecha: { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lt: new Date(hasta) } : {}) } } : {}),
      },
      include: PUBLICACION_INCLUDE,
      orderBy: { fecha: 'asc' },
    });
  }

  private async validarResponsables(organizationId: string, ids: (string | null | undefined)[]) {
    const unicos = [...new Set(ids.filter((id): id is string => !!id))];
    if (unicos.length === 0) return;
    const existen = await this.prisma.membership.count({ where: { id: { in: unicos }, organizationId } });
    if (existen !== unicos.length) throw new BadRequestException('El responsable no pertenece a esta organización');
  }

  private async validarCategorias(organizationId: string, ids: (string | null | undefined)[]) {
    const unicos = [...new Set(ids.filter((id): id is string => !!id))];
    if (unicos.length === 0) return;
    const existen = await this.prisma.categoriaCronopost.count({ where: { id: { in: unicos }, organizationId } });
    if (existen !== unicos.length) throw new BadRequestException('La categoría no pertenece a esta organización');
  }

  private datosPublicacion(organizationId: string, input: PublicacionInput) {
    return {
      organizationId,
      fecha: new Date(input.fecha),
      redes: input.redes,
      tipo: input.tipo,
      tema: input.tema,
      copy: input.copy || null,
      hashtags: input.hashtags || null,
      estado: input.estado,
      responsableId: input.responsableId || null,
      categoriaId: input.categoriaId || null,
      notas: input.notas || null,
    };
  }

  async crear(organizationId: string, input: PublicacionInput) {
    await this.validarResponsables(organizationId, [input.responsableId]);
    await this.validarCategorias(organizationId, [input.categoriaId]);
    return this.prisma.publicacion.create({ data: this.datosPublicacion(organizationId, input), include: PUBLICACION_INCLUDE });
  }

  /** Guarda de una vez las propuestas del plan que se aceptaron (todas o ninguna). */
  async crearLote(organizationId: string, publicaciones: PublicacionInput[]) {
    await this.validarResponsables(organizationId, publicaciones.map((p) => p.responsableId));
    await this.validarCategorias(organizationId, publicaciones.map((p) => p.categoriaId));
    const creadas = await this.prisma.$transaction(
      publicaciones.map((p) => this.prisma.publicacion.create({ data: this.datosPublicacion(organizationId, p), select: { id: true } })),
    );
    return { creadas: creadas.length };
  }

  async actualizar(organizationId: string, id: string, input: ActualizarPublicacionInput) {
    const publicacion = await this.prisma.publicacion.findFirst({ where: { id, organizationId } });
    if (!publicacion) throw new BadRequestException('La publicación no existe en esta organización');
    if (input.responsableId !== undefined) await this.validarResponsables(organizationId, [input.responsableId]);
    if (input.categoriaId !== undefined) await this.validarCategorias(organizationId, [input.categoriaId]);
    return this.prisma.publicacion.update({
      where: { id },
      data: {
        fecha: input.fecha === undefined ? undefined : new Date(input.fecha),
        redes: input.redes,
        tipo: input.tipo,
        tema: input.tema,
        copy: input.copy === undefined ? undefined : input.copy || null,
        hashtags: input.hashtags === undefined ? undefined : input.hashtags || null,
        estado: input.estado,
        responsableId: input.responsableId === undefined ? undefined : input.responsableId || null,
        categoriaId: input.categoriaId === undefined ? undefined : input.categoriaId || null,
        notas: input.notas === undefined ? undefined : input.notas || null,
      },
      include: PUBLICACION_INCLUDE,
    });
  }

  async eliminar(organizationId: string, id: string) {
    const publicacion = await this.prisma.publicacion.findFirst({ where: { id, organizationId } });
    if (!publicacion) throw new BadRequestException('La publicación no existe en esta organización');
    await this.prisma.publicacion.delete({ where: { id } });
    return { ok: true };
  }

  // ── Configuración de la IA ───────────────────────────────────

  async obtenerConfig(organizationId: string): Promise<CronopostConfigInput & { guardada: boolean }> {
    const cfg = await this.prisma.cronopostConfig.findUnique({ where: { organizationId } });
    if (!cfg) return { ...CONFIG_INICIAL, guardada: false };
    return {
      descripcion: cfg.descripcion,
      publicoObjetivo: cfg.publicoObjetivo,
      productos: cfg.productos,
      tono: (cfg.tono as TonoCopy) ?? 'CERCANO',
      redes: cfg.redes,
      publicacionesPorSemana: cfg.publicacionesPorSemana,
      dias: cfg.dias as DiaSemana[],
      horarios: cfg.horarios,
      hashtagsFijos: cfg.hashtagsFijos,
      restricciones: cfg.restricciones,
      guardada: true,
    };
  }

  async guardarConfig(organizationId: string, input: CronopostConfigInput) {
    const datos = {
      descripcion: input.descripcion || null,
      publicoObjetivo: input.publicoObjetivo || null,
      productos: input.productos || null,
      tono: input.tono,
      redes: input.redes,
      publicacionesPorSemana: input.publicacionesPorSemana,
      dias: input.dias,
      horarios: [...new Set(input.horarios)].sort(),
      hashtagsFijos: input.hashtagsFijos || null,
      restricciones: input.restricciones || null,
    };
    await this.prisma.cronopostConfig.upsert({ where: { organizationId }, create: { organizationId, ...datos }, update: datos });
    return this.obtenerConfig(organizationId);
  }

  // ── Categorías ───────────────────────────────────────────────

  listarCategorias(organizationId: string) {
    return this.prisma.categoriaCronopost.findMany({
      where: { organizationId },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { publicaciones: true } } },
    });
  }

  /** Los nombres no se repiten (sin distinguir mayúsculas): "crédito" y "Crédito" son la misma. */
  private async exigirNombreLibre(organizationId: string, nombre: string, exceptoId?: string) {
    const repetida = await this.prisma.categoriaCronopost.findFirst({
      where: { organizationId, nombre: { equals: nombre, mode: 'insensitive' }, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
      select: { id: true },
    });
    if (repetida) throw new BadRequestException('Ya existe una categoría con ese nombre');
  }

  async crearCategoria(organizationId: string, input: CategoriaCronopostInput) {
    const cantidad = await this.prisma.categoriaCronopost.count({ where: { organizationId } });
    if (cantidad >= MAX_CATEGORIAS) throw new BadRequestException(`Se permiten hasta ${MAX_CATEGORIAS} categorías`);
    await this.exigirNombreLibre(organizationId, input.nombre);
    const ultima = await this.prisma.categoriaCronopost.aggregate({ where: { organizationId }, _max: { orden: true } });
    return this.prisma.categoriaCronopost.create({
      data: { organizationId, nombre: input.nombre, color: input.color, descripcion: input.descripcion || null, orden: (ultima._max.orden ?? 0) + 1 },
      include: { _count: { select: { publicaciones: true } } },
    });
  }

  async actualizarCategoria(organizationId: string, id: string, input: ActualizarCategoriaCronopostInput) {
    const categoria = await this.prisma.categoriaCronopost.findFirst({ where: { id, organizationId } });
    if (!categoria) throw new BadRequestException('La categoría no existe en esta organización');
    if (input.nombre && input.nombre !== categoria.nombre) await this.exigirNombreLibre(organizationId, input.nombre, id);
    return this.prisma.categoriaCronopost.update({
      where: { id },
      data: {
        nombre: input.nombre,
        color: input.color,
        descripcion: input.descripcion === undefined ? undefined : input.descripcion || null,
        orden: input.orden,
      },
      include: { _count: { select: { publicaciones: true } } },
    });
  }

  /** Las publicaciones de la categoría no se borran: quedan sin categoría. */
  async eliminarCategoria(organizationId: string, id: string) {
    const categoria = await this.prisma.categoriaCronopost.findFirst({ where: { id, organizationId } });
    if (!categoria) throw new BadRequestException('La categoría no existe en esta organización');
    await this.prisma.categoriaCronopost.delete({ where: { id } });
    return { ok: true };
  }

  /** Contexto de marca común a todos los pedidos a la IA. Solo lleva lo que la organización
   *  escribió en la configuración: nunca datos de socios ni prospectos. */
  private async contextoMarca(organizationId: string) {
    const [org, cfg] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { nombre: true } }),
      this.obtenerConfig(organizationId),
    ]);
    const system = [
      `Eres el community manager de "${org.nombre}", una cooperativa de ahorro y crédito de Ecuador regulada por la SEPS.`,
      cfg.descripcion ? `Sobre la institución: ${cfg.descripcion}` : null,
      cfg.publicoObjetivo ? `Público objetivo: ${cfg.publicoObjetivo}` : null,
      cfg.productos ? `Productos y servicios: ${cfg.productos}` : null,
      'Escribes en español de Ecuador, sin anglicismos innecesarios. Reglas: no prometas rendimientos, tasas, montos ni ' +
        'aprobaciones que no estén en la información dada; no inventes cifras, requisitos ni fechas; no pidas datos personales ' +
        'por redes sociales; invita a canales oficiales (agencias, WhatsApp oficial, página web) cuando corresponda; usa ' +
        'emojis con moderación.',
      cfg.restricciones ? `Además, evita siempre: ${cfg.restricciones}` : null,
    ].filter(Boolean).join('\n');
    return { cfg, system };
  }

  // ── Generación con IA ────────────────────────────────────────

  /** Propone 3 copies para una publicación. */
  async generarCopy(organizationId: string, input: GenerarCopyInput) {
    const { cfg, system } = await this.contextoMarca(organizationId);
    const limite = Math.min(...input.redes.map((r) => LIMITE_COPY[r]));
    const categoria = input.categoriaId
      ? await this.prisma.categoriaCronopost.findFirst({ where: { id: input.categoriaId, organizationId }, select: { nombre: true, descripcion: true } })
      : null;
    const respuesta = await llamarChatJSON({
      credenciales: await this.ia.credenciales(organizationId),
      system: `${system}\nDevuelve 3 propuestas distintas entre sí.`,
      user: [
        `Tema: ${input.tema}`,
        categoria ? `Categoría: ${categoria.nombre}${categoria.descripcion ? ` (${categoria.descripcion})` : ''}` : null,
        input.objetivo ? `Objetivo: ${input.objetivo}` : null,
        `Redes: ${input.redes.map((r) => NOMBRE_RED[r]).join(', ')}`,
        `Formato de la pieza: ${input.tipo.toLowerCase()}`,
        `Tono: ${TONO[input.tono]}`,
        `Cada copy debe tener como máximo ${limite} caracteres (sin contar los hashtags).`,
        'En "hashtags" pon entre 3 y 6 hashtags separados por espacios, empezando con #.',
      ].filter(Boolean).join('\n'),
      schemaName: 'propuestas_copy',
      schema: ESQUEMA_COPY,
      timeoutMs: 30_000,
    });
    const validada = respuestaCopySchema.safeParse(respuesta);
    if (!validada.success) throw new BadRequestException('El servicio de IA devolvió un formato inesperado. Intenta de nuevo.');
    const opciones = validada.data.opciones.slice(0, 3).map((o) => ({ copy: o.copy, hashtags: unirHashtags(o.hashtags, cfg.hashtagsFijos) }));
    return { opciones, limite };
  }

  /** Semana (lunes a domingo) o mes que contiene la fecha pedida, en la hora local del servidor. */
  private rangoPeriodo(periodo: GenerarPlanInput['periodo'], inicio: string): { desde: Date; hasta: Date } {
    const [y, m, d] = inicio.split('-').map(Number);
    if (periodo === 'MES') return { desde: new Date(y, m - 1, 1), hasta: new Date(y, m, 1) };
    const base = new Date(y, m - 1, d);
    const desde = new Date(y, m - 1, d - ((base.getDay() + 6) % 7));
    return { desde, hasta: new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 7) };
  }

  /** Fechas y horas de publicación del período según la configuración: en cada semana se reparten
   *  `publicacionesPorSemana` entre los días y horarios elegidos (parejas, no todas al inicio).
   *  Se calculan aquí y no en la IA, para que siempre respeten los días y horarios configurados. */
  private calcularEspacios(cfg: CronopostConfigInput, desde: Date, hasta: Date): Date[] {
    const ahora = new Date();
    const dias = new Set(cfg.dias.map((d) => DIA_JS[d]));
    const horarios = [...cfg.horarios].sort().map((h) => h.split(':').map(Number));
    const espacios: Date[] = [];
    const lunes = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() - ((desde.getDay() + 6) % 7));
    for (let semana = lunes; semana < hasta; semana = new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + 7)) {
      const candidatos: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const dia = new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + i);
        if (!dias.has(dia.getDay())) continue;
        for (const [h, min] of horarios) candidatos.push(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, min));
      }
      const n = Math.min(cfg.publicacionesPorSemana, candidatos.length);
      for (let i = 0; i < n; i++) {
        const f = candidatos[Math.floor((i * candidatos.length) / n)];
        if (f >= desde && f < hasta && f > ahora) espacios.push(f);
      }
    }
    return espacios.slice(0, MAX_ESPACIOS);
  }

  /** Arma el plan de una semana o un mes: calcula los espacios y le pide a la IA el contenido de
   *  cada uno. No guarda nada: devuelve las propuestas para que el equipo elija cuáles agregar. */
  async generarPlan(organizationId: string, input: GenerarPlanInput) {
    const { cfg, system } = await this.contextoMarca(organizationId);
    const { desde, hasta } = this.rangoPeriodo(input.periodo, input.inicio);
    const espacios = this.calcularEspacios(cfg, desde, hasta);
    if (espacios.length === 0) {
      throw new BadRequestException('No quedan días ni horarios disponibles en ese período según la configuración (puede que ya haya pasado).');
    }

    const existentes = await this.prisma.publicacion.findMany({
      where: { organizationId, fecha: { gte: desde, lt: hasta } },
      select: { fecha: true, tema: true },
      orderBy: { fecha: 'asc' },
    });
    const limite = Math.min(...cfg.redes.map((r) => LIMITE_COPY[r]));
    const todas = await this.listarCategorias(organizationId);
    const categorias = input.categoriaIds?.length ? todas.filter((c) => input.categoriaIds!.includes(c.id)) : todas;
    if (categorias.length === 0) {
      throw new BadRequestException('No hay categorías para repartir. Crea al menos una en Cronopost → Configuración.');
    }
    const porNombre = new Map(categorias.map((c) => [c.nombre, c]));

    const respuesta = await llamarChatJSON({
      credenciales: await this.ia.credenciales(organizationId),
      system: `${system}\nArmas el cronograma de publicaciones (cronopost) de redes sociales de la cooperativa.`,
      user: [
        `Período: ${input.periodo === 'SEMANA' ? 'semana' : 'mes'} del ${desde.toLocaleDateString('es-EC')} al ${new Date(hasta.getTime() - 1).toLocaleDateString('es-EC')}.`,
        `Categorías de contenido (repártelas de forma equilibrada y escribe en "categoria" el nombre exacto de la que usaste):\n${categorias.map((c) => `- ${c.nombre}${c.descripcion ? `: ${c.descripcion}` : ''}`).join('\n')}`,
        `Redes disponibles (usa en cada publicación una o varias de estas, según convenga al formato): ${cfg.redes.map((r) => `${r} (${NOMBRE_RED[r]})`).join(', ')}.`,
        `Tono: ${TONO[cfg.tono]}.`,
        input.indicaciones ? `Indicaciones para este período: ${input.indicaciones}` : null,
        existentes.length
          ? `Ya hay estas publicaciones planificadas en el período (no repitas sus temas):\n${existentes.map((e) => `- ${fechaLegible(e.fecha)}: ${e.tema}`).join('\n')}`
          : null,
        `Genera exactamente una publicación para cada uno de estos ${espacios.length} espacios, indicando su número en "espacio":`,
        ...espacios.map((f, i) => `${i + 1}. ${fechaLegible(f)}`),
        'Si un espacio coincide con una fecha conmemorativa relevante en Ecuador, puedes aprovecharla.',
        `"tema": título corto (máximo 80 caracteres). "copy": máximo ${limite} caracteres sin contar hashtags. ` +
          '"hashtags": entre 3 y 6, separados por espacios, empezando con #. Varía los formatos de pieza.',
      ].filter(Boolean).join('\n'),
      schemaName: 'plan_cronopost',
      schema: esquemaPlan(categorias.map((c) => c.nombre)),
      timeoutMs: 90_000,
    });

    const validada = respuestaPlanSchema.safeParse(respuesta);
    if (!validada.success) throw new BadRequestException('El servicio de IA devolvió un formato inesperado. Intenta de nuevo.');

    const usados = new Set<number>();
    const propuestas = validada.data.publicaciones.flatMap((p) => {
      const i = p.espacio - 1;
      if (i < 0 || i >= espacios.length || usados.has(i)) return [];
      usados.add(i);
      const redes = p.redes.filter((r) => cfg.redes.includes(r));
      const categoria = porNombre.get(p.categoria) ?? null;
      return [{
        fecha: espacios[i].toISOString(),
        tema: p.tema.slice(0, 160),
        categoriaId: categoria?.id ?? null,
        categoria: categoria ? { id: categoria.id, nombre: categoria.nombre, color: categoria.color } : null,
        tipo: p.tipo as TipoPieza,
        redes: redes.length ? [...new Set(redes)] : cfg.redes,
        copy: p.copy,
        hashtags: unirHashtags(p.hashtags, cfg.hashtagsFijos),
      }];
    }).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const sinCubrir = espacios.length - propuestas.length;
    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      propuestas,
      aviso: sinCubrir > 0 ? `La IA no completó ${sinCubrir} de los ${espacios.length} espacios; puedes volver a generar o agregarlos a mano.` : null,
    };
  }
}
