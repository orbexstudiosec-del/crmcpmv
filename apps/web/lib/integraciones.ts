import type { LucideIcon } from "lucide-react";
import { MessageCircle, Facebook, Instagram, Music2 } from "lucide-react";

/** WhatsApp solo por la API oficial de Meta: la conexión por código QR no está autorizada. */
export type CanalMensajeria = "WHATSAPP_API" | "MESSENGER" | "INSTAGRAM" | "TIKTOK";
export type EstadoIntegracion = "DESCONECTADO" | "PENDIENTE" | "CONECTADO" | "ERROR";

export interface IntegracionEstado {
  canal: CanalMensajeria;
  estado: EstadoIntegracion;
  etiqueta: string | null;
  conectadoEn: string | null;
}

export interface CampoIntegracion {
  name: string;
  label: string;
  type?: "text" | "password" | "url";
  placeholder?: string;
  opcional?: boolean;
}

export interface CanalConfig {
  canal: CanalMensajeria;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Fondo + color del ícono con la identidad visual de cada plataforma (no el genérico bg-primary-soft). */
  claseIcono: string;
  campos: CampoIntegracion[];
}

export const CANALES_MENSAJERIA: CanalConfig[] = [
  {
    canal: "WHATSAPP_API",
    label: "WhatsApp Business (API oficial)",
    desc: "WhatsApp Business Platform de Meta (Cloud API) — para números verificados de empresa.",
    icon: MessageCircle,
    claseIcono: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    campos: [
      { name: "phoneNumberId", label: "Phone Number ID" },
      { name: "wabaId", label: "WhatsApp Business Account ID" },
      { name: "accessToken", label: "Access token", type: "password" },
      { name: "verifyToken", label: "Verify token (webhook)", type: "password" },
      { name: "appSecret", label: "App Secret (valida la firma de los eventos)", type: "password", placeholder: "Recomendado", opcional: true },
    ],
  },
  {
    canal: "MESSENGER",
    label: "Messenger",
    desc: "Página de Facebook de tu negocio. Por ahora solo valida la conexión: recibir y responder mensajes llega en la siguiente versión.",
    icon: Facebook,
    claseIcono: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    campos: [
      { name: "pageId", label: "Page ID" },
      { name: "pageAccessToken", label: "Page access token", type: "password" },
    ],
  },
  {
    canal: "INSTAGRAM",
    label: "Instagram",
    desc: "Cuenta de Instagram profesional. Por ahora solo valida la conexión: recibir y responder mensajes llega en la siguiente versión.",
    icon: Instagram,
    claseIcono: "bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white",
    campos: [
      { name: "igBusinessId", label: "Instagram Business Account ID" },
      { name: "accessToken", label: "Access token", type: "password" },
    ],
  },
  {
    canal: "TIKTOK",
    label: "TikTok",
    desc: "TikTok for Business. Por ahora solo guarda y valida las credenciales.",
    icon: Music2,
    claseIcono: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
    campos: [
      { name: "clientKey", label: "Client key" },
      { name: "clientSecret", label: "Client secret", type: "password" },
      { name: "accessToken", label: "Access token (opcional por ahora)", type: "password", opcional: true },
    ],
  },
];
