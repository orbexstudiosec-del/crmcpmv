import type { LucideIcon } from "lucide-react";
import {
  Facebook, Instagram, Music2, MessageCircle, Linkedin, Youtube, Twitter,
  Image as ImageIcon, GalleryHorizontal, Clapperboard, CircleDashed, Video, Type,
} from "lucide-react";

export type RedSocial = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "WHATSAPP" | "LINKEDIN" | "YOUTUBE" | "X";
export type TipoPieza = "IMAGEN" | "CARRUSEL" | "REEL" | "HISTORIA" | "VIDEO" | "TEXTO";
export type EstadoPublicacion = "IDEA" | "DISENO" | "REVISION" | "APROBADO" | "PUBLICADO";
export type TonoCopy = "CERCANO" | "INFORMATIVO" | "INSPIRADOR" | "FORMAL";

/** Categoría temática configurable (ej. Crédito, Inversiones, Seguridad). */
export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  orden: number;
  _count?: { publicaciones: number };
}
export type CategoriaLite = Pick<Categoria, "id" | "nombre" | "color">;

export interface Publicacion {
  id: string;
  fecha: string;
  redes: RedSocial[];
  tipo: TipoPieza;
  tema: string;
  copy: string | null;
  hashtags: string | null;
  estado: EstadoPublicacion;
  responsableId: string | null;
  categoriaId: string | null;
  notas: string | null;
  responsable: { id: string; user: { nombre: string } } | null;
  categoria: CategoriaLite | null;
}

/** `limite`: largo máximo del texto en esa red (debe coincidir con LIMITE_COPY del API). */
export const REDES: { v: RedSocial; l: string; icon: LucideIcon; color: string; limite: number }[] = [
  { v: "FACEBOOK", l: "Facebook", icon: Facebook, color: "#1877F2", limite: 2200 },
  { v: "INSTAGRAM", l: "Instagram", icon: Instagram, color: "#E4405F", limite: 2200 },
  { v: "TIKTOK", l: "TikTok", icon: Music2, color: "#111827", limite: 2200 },
  { v: "WHATSAPP", l: "WhatsApp", icon: MessageCircle, color: "#25D366", limite: 700 },
  { v: "LINKEDIN", l: "LinkedIn", icon: Linkedin, color: "#0A66C2", limite: 3000 },
  { v: "YOUTUBE", l: "YouTube", icon: Youtube, color: "#FF0000", limite: 5000 },
  { v: "X", l: "X", icon: Twitter, color: "#334155", limite: 280 },
];
export const redInfo = (v: RedSocial) => REDES.find((r) => r.v === v) ?? REDES[0];

export const TIPOS_PIEZA: { v: TipoPieza; l: string; icon: LucideIcon }[] = [
  { v: "IMAGEN", l: "Imagen", icon: ImageIcon },
  { v: "CARRUSEL", l: "Carrusel", icon: GalleryHorizontal },
  { v: "REEL", l: "Reel", icon: Clapperboard },
  { v: "HISTORIA", l: "Historia", icon: CircleDashed },
  { v: "VIDEO", l: "Video", icon: Video },
  { v: "TEXTO", l: "Solo texto", icon: Type },
];
export const tipoInfo = (v: TipoPieza) => TIPOS_PIEZA.find((t) => t.v === v) ?? TIPOS_PIEZA[0];

/** El orden es el del flujo de trabajo. */
export const ESTADOS: { v: EstadoPublicacion; l: string; color: string }[] = [
  { v: "IDEA", l: "Idea", color: "#94a3b8" },
  { v: "DISENO", l: "En diseño", color: "#7c5cfc" },
  { v: "REVISION", l: "En revisión", color: "#eda100" },
  { v: "APROBADO", l: "Aprobado", color: "#2a78d6" },
  { v: "PUBLICADO", l: "Publicado", color: "#16a34a" },
];
export const estadoInfo = (v: EstadoPublicacion) => ESTADOS.find((e) => e.v === v) ?? ESTADOS[0];

export const TONOS: { v: TonoCopy; l: string }[] = [
  { v: "CERCANO", l: "Cercano" },
  { v: "INFORMATIVO", l: "Informativo" },
  { v: "INSPIRADOR", l: "Inspirador" },
  { v: "FORMAL", l: "Formal" },
];

/** Límite de caracteres más restrictivo entre las redes elegidas. */
export function limiteCopy(redes: RedSocial[]): number | null {
  return redes.length ? Math.min(...redes.map((r) => redInfo(r).limite)) : null;
}

// ── Configuración de la IA y plan generado ──────────────────────

export type DiaSemana = "LUN" | "MAR" | "MIE" | "JUE" | "VIE" | "SAB" | "DOM";
export const DIAS: { v: DiaSemana; l: string }[] = [
  { v: "LUN", l: "Lun" }, { v: "MAR", l: "Mar" }, { v: "MIE", l: "Mié" }, { v: "JUE", l: "Jue" },
  { v: "VIE", l: "Vie" }, { v: "SAB", l: "Sáb" }, { v: "DOM", l: "Dom" },
];

export interface CronopostConfig {
  descripcion: string | null;
  publicoObjetivo: string | null;
  productos: string | null;
  tono: TonoCopy;
  redes: RedSocial[];
  publicacionesPorSemana: number;
  dias: DiaSemana[];
  horarios: string[];
  hashtagsFijos: string | null;
  restricciones: string | null;
  /** false = todavía no se guardó; son los valores iniciales. */
  guardada: boolean;
}

/** Una publicación propuesta por la IA en el plan (todavía no guardada). */
export interface PropuestaPlan {
  fecha: string;
  tema: string;
  categoriaId: string | null;
  categoria: CategoriaLite | null;
  tipo: TipoPieza;
  redes: RedSocial[];
  copy: string;
  hashtags: string;
}

/** Colores sugeridos al crear una categoría. */
export const COLORES_CATEGORIA = ["#2a78d6", "#16a34a", "#e0433d", "#7c5cfc", "#eda100", "#0891b2", "#db2777", "#64748b"];
