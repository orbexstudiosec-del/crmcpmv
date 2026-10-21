import type { LucideIcon } from "lucide-react";
import {
  Phone, Mail, Users2, CheckSquare, StickyNote, Circle, UserPlus, Workflow, MessageCircle, Bot,
  CalendarClock, HandCoins, AlertTriangle, ShieldCheck,
} from "lucide-react";

export interface Lead { id: string; fuente: string | null; estado: string; createdAt: string }
export interface Oportunidad { id: string; etapa: string; monto: string; createdAt: string }
export interface Actividad {
  id: string; tipo: string; asunto: string; completada: boolean;
  inicio: string | null; vencimiento: string | null; createdAt: string;
}

/** Los campos de fecha "solo día" (Actividad.inicio/vencimiento) llegan del API como medianoche
 *  UTC (ej. "2026-07-20T00:00:00.000Z"). Leerlos con getters locales corre el día en zonas
 *  detrás de UTC — Ecuador es UTC-5 — así que hay que leer los getters UTC para recuperar el
 *  día calendario real sin importar la zona horaria del navegador. */
export function diaCalendario(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export type TipoEtapaPipeline = "ABIERTA" | "GANADA" | "PERDIDA";
export interface EtapaPipelineDef { id: string; label: string; color: string; descripcion?: string; tipo: TipoEtapaPipeline }

/** Las 6 etapas de fábrica del embudo de Oportunidades. La empresa puede renombrar,
 * recolorear, reordenar o eliminar cualquiera de ellas (incluidas Ganada/Perdida) desde
 * Configuración — por eso el resto del código nunca compara contra el id literal "GANADA",
 * sino contra `tipo` (ver idsGanada). */
/** Hex literal (no var()) a propósito: el editor de Configuración usa <input type="color">
 *  sobre este mismo valor, que solo acepta "#rrggbb" — una custom property ahí se ignora
 *  y el picker cae a negro. Por eso estos son los pasos CLAROS de la paleta validada, sin
 *  variante oscura (igual que antes: un solo hex por etapa, elegido y guardado por el
 *  usuario en Configuración, no recalculado por tema). */
export const ETAPAS_PIPELINE_DEFAULT: EtapaPipelineDef[] = [
  { id: "PROSPECTO", label: "Prospecto", color: "#2a78d6", tipo: "ABIERTA" },
  { id: "CONTACTO", label: "Contacto", color: "#eb6834", tipo: "ABIERTA" },
  { id: "PROPUESTA", label: "Propuesta", color: "#1baf7a", tipo: "ABIERTA" },
  { id: "NEGOCIACION", label: "Negociación", color: "#eda100", tipo: "ABIERTA" },
  // Ganada/Perdida no son identidad de serie sino un resultado bueno/malo — color de estado, no categórico.
  { id: "GANADA", label: "Ganada", color: "#0ca30c", tipo: "GANADA" },
  { id: "PERDIDA", label: "Perdida", color: "#d03b3b", tipo: "PERDIDA" },
];

/** El embudo completo de la empresa, ya en el orden real de las columnas del Kanban. Si el
 * empresa no personalizó nada todavía, usa las 6 etapas de fábrica. */
export function pipelineEfectivo(custom: EtapaPipelineDef[] | null | undefined): EtapaPipelineDef[] {
  return custom && custom.length ? custom : ETAPAS_PIPELINE_DEFAULT;
}

/** Ids de las etapas marcadas como "Ganada" — puede haber cero, una o varias. Se usa para
 * calcular tasa de cierre / ventas ganadas sin depender del nombre o id literal de la etapa. */
export function idsGanada(etapas: EtapaPipelineDef[]): Set<string> {
  return new Set(etapas.filter((e) => e.tipo === "GANADA").map((e) => e.id));
}

export const FUENTE_COLORES = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];
export const COLOR_OTROS = "var(--color-muted)";
export const ACENTOS_KPI = [
  "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
  "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-6)",
];

export const TIPO_ICONO: Record<string, LucideIcon> = {
  LLAMADA: Phone, EMAIL: Mail, REUNION: Users2, TAREA: CheckSquare, NOTA: StickyNote,
};
export const TIPO_COLOR: Record<string, string> = {
  LLAMADA: "var(--color-chart-1)", EMAIL: "var(--color-chart-2)", REUNION: "var(--color-chart-3)",
  TAREA: "var(--color-chart-4)", NOTA: "var(--color-muted)",
};
export const TIPO_ICONO_DEFAULT: LucideIcon = Circle;

export type TipoNotificacion =
  | "LEAD_NUEVO" | "LEAD_CONVERTIDO" | "MENSAJE_NUEVO" | "BOT_ACTIVADO"
  | "CITA_AGENDADA" | "RIESGO_APROBADO";
export const NOTIF_ICONO: Record<TipoNotificacion, LucideIcon> = {
  LEAD_NUEVO: UserPlus, LEAD_CONVERTIDO: Workflow, MENSAJE_NUEVO: MessageCircle, BOT_ACTIVADO: Bot,
  CITA_AGENDADA: CalendarClock, RIESGO_APROBADO: ShieldCheck,
};
export const NOTIF_COLOR: Record<TipoNotificacion, string> = {
  // Identidad del tipo de evento — categórico.
  LEAD_NUEVO: "var(--color-chart-1)", LEAD_CONVERTIDO: "var(--color-chart-2)",
  MENSAJE_NUEVO: "var(--color-chart-3)", BOT_ACTIVADO: "var(--color-chart-4)", CITA_AGENDADA: "var(--color-chart-5)", RIESGO_APROBADO: "var(--color-status-good)",
};
export const NOTIF_LABEL: Record<TipoNotificacion, string> = {
  LEAD_NUEVO: "Lead nuevo", LEAD_CONVERTIDO: "Lead convertido", MENSAJE_NUEVO: "Mensaje nuevo", BOT_ACTIVADO: "Bot activado",
  CITA_AGENDADA: "Cita agendada", RIESGO_APROBADO: "Prospecto aprobado",
};

export const money = (v: number) => `$${v.toLocaleString("es-EC", { maximumFractionDigits: 0 })}`;

export function tiempoRelativo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}

// ── Tendencias reales (semana actual vs. semana anterior), derivadas de createdAt. Sin cifras inventadas. ──
export const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
export function enVentana(iso: string, desdeMs: number, hastaMs: number) {
  const edad = Date.now() - new Date(iso).getTime();
  return edad >= desdeMs && edad < hastaMs;
}
export type Tendencia = { pct: number; subio: boolean; sufijo?: string } | null;
export function tendenciaDesde(actual: number, anterior: number): Tendencia {
  if (actual === 0 && anterior === 0) return null;
  if (anterior === 0) return { pct: 100, subio: true };
  const delta = Math.round(((actual - anterior) / anterior) * 100);
  if (delta === 0) return null;
  return { pct: Math.abs(delta), subio: delta >= 0 };
}
export function tendenciaConteo(fechas: string[]): Tendencia {
  const actual = fechas.filter((f) => enVentana(f, 0, SEMANA_MS)).length;
  const anterior = fechas.filter((f) => enVentana(f, SEMANA_MS, SEMANA_MS * 2)).length;
  return tendenciaDesde(actual, anterior);
}
export function tendenciaMonto(items: { createdAt: string; monto: number }[]): Tendencia {
  const actual = items.filter((i) => enVentana(i.createdAt, 0, SEMANA_MS)).reduce((s, i) => s + i.monto, 0);
  const anterior = items.filter((i) => enVentana(i.createdAt, SEMANA_MS, SEMANA_MS * 2)).reduce((s, i) => s + i.monto, 0);
  return tendenciaDesde(actual, anterior);
}
export function tendenciaConversionPts(ops: Oportunidad[], etapas: EtapaPipelineDef[]): Tendencia {
  const ganadaIds = idsGanada(etapas);
  const ratio = (arr: Oportunidad[]) => (arr.length ? (arr.filter((o) => ganadaIds.has(o.etapa)).length / arr.length) * 100 : null);
  const a = ratio(ops.filter((o) => enVentana(o.createdAt, 0, SEMANA_MS)));
  const b = ratio(ops.filter((o) => enVentana(o.createdAt, SEMANA_MS, SEMANA_MS * 2)));
  if (a === null || b === null) return null;
  const delta = Math.round(a - b);
  if (delta === 0) return null;
  return { pct: Math.abs(delta), subio: delta >= 0, sufijo: "pts" };
}

export function inicioSemana(d = new Date()) {
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

// ── Series derivadas para embudo / donas ──

/** Pasos del embudo para el gráfico: las etapas "abiertas" en el orden de la empresa, más un
 * paso agregado de cierre con el conteo de todas las etapas tipo GANADA. */
export function construirFunnel(oportunidades: Oportunidad[], etapas: EtapaPipelineDef[]) {
  const abiertas = etapas.filter((e) => e.tipo === "ABIERTA");
  const ganadaIds = idsGanada(etapas);
  return [
    ...abiertas.map((e) => ({ v: e.id, l: e.label, color: e.color, count: oportunidades.filter((o) => o.etapa === e.id).length })),
    { v: "__GANADA__", l: "Cerradas ganadas", color: "var(--color-status-good)", count: oportunidades.filter((o) => ganadaIds.has(o.etapa)).length },
  ];
}

export function pipelinePorEtapa(oportunidades: Oportunidad[], etapas: EtapaPipelineDef[]) {
  const abiertas = etapas.filter((e) => e.tipo === "ABIERTA");
  const ganadaIds = idsGanada(etapas);
  const pasos = [
    ...abiertas.map((e) => ({
      label: e.label,
      color: e.color,
      value: oportunidades.filter((o) => o.etapa === e.id).reduce((s, o) => s + Number(o.monto), 0),
    })),
    {
      label: "Cerradas ganadas",
      color: "var(--color-status-good)",
      value: oportunidades.filter((o) => ganadaIds.has(o.etapa)).reduce((s, o) => s + Number(o.monto), 0),
    },
  ];
  return pasos.filter((d) => d.value > 0);
}

export function leadsPorFuente(leads: Lead[]) {
  const fuenteConteo = new Map<string, number>();
  leads.forEach((l) => {
    const key = l.fuente?.trim() || "Sin especificar";
    fuenteConteo.set(key, (fuenteConteo.get(key) ?? 0) + 1);
  });
  const fuenteOrdenada = [...fuenteConteo.entries()].sort((a, b) => b[1] - a[1]);
  return [
    ...fuenteOrdenada.slice(0, 4).map(([label, value], i) => ({ label, value, color: FUENTE_COLORES[i] })),
    ...(fuenteOrdenada.length > 4
      ? [{ label: "Otros", value: fuenteOrdenada.slice(4).reduce((s, [, v]) => s + v, 0), color: COLOR_OTROS }]
      : []),
  ];
}

/** Serie semanal (últimas N semanas) de oportunidades creadas, contando también las ganadas. Datos reales, sin proyección. */
export function oportunidadesPorSemana(oportunidades: Oportunidad[], etapas: EtapaPipelineDef[], semanas = 8) {
  const ganadaIds = idsGanada(etapas);
  const hoy = inicioSemana();
  const filas: { etiqueta: string; creadas: number; ganadas: number }[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const desde = new Date(hoy); desde.setDate(hoy.getDate() - i * 7);
    const hasta = new Date(desde); hasta.setDate(desde.getDate() + 7);
    const enRango = oportunidades.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= desde.getTime() && t < hasta.getTime();
    });
    filas.push({
      etiqueta: desde.toLocaleDateString("es-EC", { day: "numeric", month: "short" }),
      creadas: enRango.length,
      ganadas: enRango.filter((o) => ganadaIds.has(o.etapa)).length,
    });
  }
  return filas;
}
