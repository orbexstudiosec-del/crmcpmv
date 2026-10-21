export type EstadoRiesgo = "PENDIENTE" | "EN_ANALISIS" | "APROBADO" | "RECHAZADO" | "OBSERVADO";
export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

export interface LeadMini {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  estado: string;
  sucursal: { id: string; nombre: string; ciudad: string | null } | null;
}

export interface Analisis {
  id: string;
  estado: EstadoRiesgo;
  nivel: NivelRiesgo | null;
  puntaje: number | null;
  montoSolicitado: string | null;
  montoAprobado: string | null;
  ingresos: string | null;
  egresos: string | null;
  criterios: Record<string, boolean> | null;
  observaciones: string | null;
  analizadoEn: string | null;
  analizadoPor: { user: { nombre: string } } | null;
}

/** Criterios que el analista marca al revisar un prospecto. Las claves se guardan tal cual en
 *  AnalisisRiesgo.criterios; cambiar una clave aquí no borra lo ya guardado con la anterior. */
export const CRITERIOS_RIESGO: { clave: string; label: string }[] = [
  { clave: "documentacion", label: "Documentación completa (cédula, ingresos, servicios básicos)" },
  { clave: "capacidad_pago", label: "Capacidad de pago suficiente" },
  { clave: "historial", label: "Buen historial crediticio (central de riesgos)" },
  { clave: "endeudamiento", label: "Nivel de endeudamiento aceptable" },
  { clave: "estabilidad", label: "Estabilidad laboral / de ingresos" },
  { clave: "garantias", label: "Garantías o respaldo adecuados" },
  { clave: "referencias", label: "Referencias verificadas" },
];

export const ESTADO_RIESGO: Record<EstadoRiesgo, { label: string; clase: string; hex: string }> = {
  PENDIENTE: { label: "Pendiente", clase: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300", hex: "#0284c7" },
  EN_ANALISIS: { label: "En análisis", clase: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300", hex: "#d97706" },
  APROBADO: { label: "Aprobado", clase: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300", hex: "#059669" },
  RECHAZADO: { label: "Rechazado", clase: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300", hex: "#dc2626" },
  OBSERVADO: { label: "Observado", clase: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300", hex: "#7c3aed" },
};

export const NIVEL_RIESGO: Record<NivelRiesgo, { label: string; hex: string }> = {
  BAJO: { label: "Riesgo bajo", hex: "#059669" },
  MEDIO: { label: "Riesgo medio", hex: "#d97706" },
  ALTO: { label: "Riesgo alto", hex: "#dc2626" },
};

export const money = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `$${Number(v).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
