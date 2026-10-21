export type EstadoConversacion = "ABIERTA" | "PENDIENTE" | "RESUELTA";

export interface EtiquetaEstado {
  label: string;
  color: string;
}

export type EtiquetasConversacion = Partial<Record<EstadoConversacion, EtiquetaEstado>>;

export const ESTADO_INFO_DEFAULT: Record<EstadoConversacion, EtiquetaEstado> = {
  ABIERTA: { label: "Abierta", color: "#2a78d6" },
  PENDIENTE: { label: "Pendiente", color: "#eda100" },
  RESUELTA: { label: "Resuelta", color: "#1baf7a" },
};

export const ESTADOS_CONVERSACION: EstadoConversacion[] = ["ABIERTA", "PENDIENTE", "RESUELTA"];

/** Combina las etiquetas por defecto con las personalizadas de la empresa (si las hay). */
export function etiquetasEfectivas(custom: EtiquetasConversacion | null | undefined): Record<EstadoConversacion, EtiquetaEstado> {
  return {
    ABIERTA: custom?.ABIERTA ?? ESTADO_INFO_DEFAULT.ABIERTA,
    PENDIENTE: custom?.PENDIENTE ?? ESTADO_INFO_DEFAULT.PENDIENTE,
    RESUELTA: custom?.RESUELTA ?? ESTADO_INFO_DEFAULT.RESUELTA,
  };
}

export type TipoActividad = "LLAMADA" | "EMAIL" | "REUNION" | "TAREA" | "NOTA";

export const TIPOS_ACTIVIDAD: { v: TipoActividad; l: string }[] = [
  { v: "LLAMADA", l: "Llamada" },
  { v: "TAREA", l: "Tarea" },
  { v: "REUNION", l: "Reunión" },
  { v: "EMAIL", l: "Email" },
  { v: "NOTA", l: "Nota" },
];

export function etiquetaTipoActividad(tipo: TipoActividad) {
  return TIPOS_ACTIVIDAD.find((t) => t.v === tipo)?.l ?? tipo;
}
