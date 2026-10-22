"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Send, Plus,
  Search, User, Check, MessageCircle, Facebook, Instagram, Music2, Trash2, UserPlus2, StickyNote, CalendarClock, Bot,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/crm-widgets";
import { EmojiPicker } from "@/components/emoji-picker";
import { api, leerSesion } from "@/lib/api";
import { ACENTOS_KPI, pipelineEfectivo, type EtapaPipelineDef } from "@/lib/crm";
import {
  etiquetasEfectivas, TIPOS_ACTIVIDAD, etiquetaTipoActividad,
  type EstadoConversacion, type EtiquetasConversacion, type TipoActividad,
} from "@/lib/mensajes";

type TipoMensaje = "TEXTO" | "IMAGEN" | "VIDEO" | "AUDIO" | "STICKER" | "DOCUMENTO";
type Canal = "WHATSAPP_API" | "MESSENGER" | "INSTAGRAM" | "TIKTOK";

interface Mensaje {
  id: string;
  direccion: "ENTRANTE" | "SALIENTE";
  tipo: TipoMensaje;
  contenido: string;
  enviadoEn: string;
}
interface NotaConversacion {
  id: string;
  autorNombre: string;
  contenido: string;
  createdAt: string;
}
interface Conversacion {
  id: string;
  canal: Canal;
  contactoId: string;
  contactoNombre: string | null;
  fotoUrl: string | null;
  estado: EstadoConversacion;
  botPausado: boolean;
  noLeidos: number;
  ultimoMensajeEn: string | null;
  cliente: { id: string; razonSocial: string; oportunidades: { id: string; etapa: string }[] } | null;
  lead: { id: string; nombre: string; oportunidades: { id: string; etapa: string }[] } | null;
  asignadoA: { id: string; user: { id: string; nombre: string; email: string } } | null;
  mensajes: Mensaje[];
}
interface ConversacionDetalle extends Conversacion { mensajes: Mensaje[]; notas: NotaConversacion[] }
interface ClienteLite { id: string; razonSocial: string }
interface LeadLite { id: string; nombre: string }
interface MiembroLite { id: string; user: { id: string; nombre: string; email: string } }
interface OrganizacionLite {
  etiquetasConversacion: EtiquetasConversacion | null;
  pipelineEtapas: EtapaPipelineDef[] | null;
}
interface ActividadConv {
  id: string;
  tipo: TipoActividad;
  asunto: string;
  detalle: string | null;
  vencimiento: string | null;
  completada: boolean;
}

const CANAL_LABEL: Record<Canal, string> = {
  WHATSAPP_API: "WhatsApp Business", MESSENGER: "Messenger", INSTAGRAM: "Instagram", TIKTOK: "TikTok",
};
const CANAL_ICONO: Record<Canal, LucideIcon> = {
  WHATSAPP_API: MessageCircle, MESSENGER: Facebook, INSTAGRAM: Instagram, TIKTOK: Music2,
};
const CANAL_COLOR: Record<Canal, string> = {
  WHATSAPP_API: "#25D366", MESSENGER: "#0084FF", INSTAGRAM: "#E4405F", TIKTOK: "#111827",
};
const PREVIEW_TIPO: Record<Exclude<TipoMensaje, "TEXTO">, string> = {
  IMAGEN: "📷 Foto", VIDEO: "🎥 Video", AUDIO: "🎤 Nota de voz", STICKER: "🩹 Sticker", DOCUMENTO: "📄 Documento",
};

function hora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}
function fechaCorta(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return hora(iso);
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}
function etiquetaDia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  const s = d.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: d.getFullYear() !== hoy.getFullYear() ? "numeric" : undefined });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const CONTENIDO_GENERICO = new Set(["Imagen", "Video", "Audio", "Nota de voz", "Sticker", "Documento"]);

function previewTexto(m?: Mensaje) {
  if (!m) return null;
  return m.tipo === "TEXTO" ? m.contenido : PREVIEW_TIPO[m.tipo];
}
function colorAvatar(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return ACENTOS_KPI[Math.abs(hash) % ACENTOS_KPI.length];
}
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}
function nombreConversacion(c: Conversacion) {
  return c.cliente?.razonSocial ?? c.lead?.nombre ?? c.contactoNombre ?? null;
}
function etapaConversacion(c: Conversacion) {
  return c.cliente?.oportunidades[0]?.etapa ?? c.lead?.oportunidades[0]?.etapa;
}

/** Algunos errores del API (ej. "WhatsApp no conectado") traen la ruta sugerida como texto
 *  ("Ve a Configuración → Integraciones."). Convierte esa frase en un link real en vez de
 *  dejarla como texto plano sin acción. */
function MensajeError({ mensaje }: { mensaje: string }) {
  const frase = "Configuración → Integraciones";
  const idx = mensaje.indexOf(frase);
  if (idx === -1) return <>{mensaje}</>;
  return (
    <>
      {mensaje.slice(0, idx)}
      <Link href="/configuracion" className="font-medium underline underline-offset-2 hover:text-red-800">
        {frase}
      </Link>
      {mensaje.slice(idx + frase.length)}
    </>
  );
}

function Avatar({
  nombre, contactoId, canal, fotoUrl, size = 40,
}: { nombre: string | null; contactoId: string; canal: Canal; fotoUrl?: string | null; size?: number }) {
  const CanalIcon = CANAL_ICONO[canal];
  const [fotoRota, setFotoRota] = useState(false);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {fotoUrl && !fotoRota ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto remota de WhatsApp, no optimizable por next/image
        <img
          src={fotoUrl}
          alt={nombre ?? contactoId}
          onError={() => setFotoRota(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: colorAvatar(contactoId) }}
        >
          {nombre ? iniciales(nombre) : <User size={size * 0.5} />}
        </span>
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-2 ring-card"
        style={{ backgroundColor: CANAL_COLOR[canal], width: size * 0.42, height: size * 0.42 }}
      >
        <CanalIcon size={size * 0.24} className="text-white" />
      </span>
    </span>
  );
}

function EtapaBadge({ info }: { info: { label: string; color: string } }) {
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ backgroundColor: `color-mix(in srgb, ${info.color} 12%, transparent)`, color: info.color }}
    >
      {info.label}
    </span>
  );
}

function EstadoBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {label}
    </span>
  );
}

export default function MensajesPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ConversacionDetalle | null>(null);
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abrirNueva, setAbrirNueva] = useState(false);
  const [numeroNuevo, setNumeroNuevo] = useState("");
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [etiquetasEstado, setEtiquetasEstado] = useState<EtiquetasConversacion | null>(null);
  const [pipelineEtapas, setPipelineEtapas] = useState<EtapaPipelineDef[] | null>(null);
  const [miembros, setMiembros] = useState<MiembroLite[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<"TODAS" | EstadoConversacion>("TODAS");
  const [soloAsignadasAMi, setSoloAsignadasAMi] = useState(false);
  const [vistaHilo, setVistaHilo] = useState<"chat" | "notas" | "actividades">("chat");
  const [notaTexto, setNotaTexto] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [abrirCrearLead, setAbrirCrearLead] = useState(false);
  const [nombreNuevoLead, setNombreNuevoLead] = useState("");
  const [creandoLead, setCreandoLead] = useState(false);
  const [actividadesConv, setActividadesConv] = useState<ActividadConv[]>([]);
  const [tipoActividad, setTipoActividad] = useState<TipoActividad>("LLAMADA");
  const [vencimientoActividad, setVencimientoActividad] = useState("");
  const [asuntoActividad, setAsuntoActividad] = useState("");
  const [creandoActividad, setCreandoActividad] = useState(false);
  /** ¿WhatsApp Business (API oficial) conectado? null = todavía no se sabe. */
  const [whatsappConectado, setWhatsappConectado] = useState<boolean | null>(null);
  const sesion = leerSesion();
  const hiloRef = useRef<HTMLDivElement>(null);
  const hiloContenidoRef = useRef<HTMLDivElement>(null);
  const cercaDelFondoRef = useRef(true);
  const idAnteriorRef = useRef<string | null>(null);
  const seleccionadaRef = useRef<string | null>(null);
  const inputTextoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { seleccionadaRef.current = seleccionada; }, [seleccionada]);

  const cargarConversaciones = () => api<Conversacion[]>("/mensajes/conversaciones").then(setConversaciones).catch(() => {});
  const refrescarDetalle = () => {
    if (!seleccionadaRef.current) return;
    api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionadaRef.current}`).then(setDetalle).catch(() => {});
  };

  useEffect(() => {
    api<ClienteLite[]>("/clientes").then(setClientes).catch(() => {});
    api<LeadLite[]>("/leads").then(setLeads).catch(() => {});
    api<MiembroLite[]>("/equipo").then(setMiembros).catch(() => {});
    api<OrganizacionLite>("/organizacion")
      .then((o) => { setEtiquetasEstado(o.etiquetasConversacion); setPipelineEtapas(o.pipelineEtapas); })
      .catch(() => {});
    cargarConversaciones();

    api<{ canal: string; estado: string }[]>("/integraciones")
      .then((r) => setWhatsappConectado(r.find((i) => i.canal === "WHATSAPP_API")?.estado === "CONECTADO"))
      .catch(() => {});

    // Los mensajes entrantes los guarda el webhook de Meta en el servidor: la lista se refresca
    // sola para que aparezcan sin recargar la página.
    const t = setInterval(cargarConversaciones, 15000);
    return () => clearInterval(t);
  }, []);

  const cargarActividadesConv = (conversacionId: string) =>
    api<ActividadConv[]>(`/actividades?conversacionId=${conversacionId}`).then(setActividadesConv).catch(() => {});

  useEffect(() => {
    setVistaHilo("chat");
    setAbrirCrearLead(false);
    setAsuntoActividad("");
    setVencimientoActividad("");
    if (!seleccionada) { setDetalle(null); setActividadesConv([]); return; }
    const cargar = () => api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}`).then(setDetalle).catch(() => {});
    cargar();
    cargarActividadesConv(seleccionada);
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [seleccionada]);

  // Detecta si el usuario está cerca del fondo del hilo — si se desplazó hacia arriba para
  // leer mensajes anteriores, el auto-scroll de abajo NO debe interrumpirlo (antes se bajaba
  // solo cada vez que llegaba un mensaje nuevo o el polling refrescaba la conversación).
  useEffect(() => {
    const contenedor = hiloRef.current;
    if (!contenedor) return;
    const onScroll = () => {
      const distanciaAlFondo = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
      cercaDelFondoRef.current = distanciaAlFondo < 120;
    };
    contenedor.addEventListener("scroll", onScroll);
    return () => contenedor.removeEventListener("scroll", onScroll);
  }, [detalle?.id, vistaHilo]);

  useEffect(() => {
    if (vistaHilo !== "chat") return;
    const esConversacionNueva = idAnteriorRef.current !== (detalle?.id ?? null);
    idAnteriorRef.current = detalle?.id ?? null;
    if (esConversacionNueva) cercaDelFondoRef.current = true; // al abrir un chat, siempre arranca al fondo
    if (!cercaDelFondoRef.current) return;
    hiloRef.current?.scrollTo({ top: hiloRef.current.scrollHeight, behavior: esConversacionNueva ? "auto" : "smooth" });
  }, [detalle?.id, detalle?.mensajes.length, vistaHilo]);

  // El contenido del hilo cambia de alto después del primer scroll (ej. una imagen o un
  // audio terminan de cargar) — sin esto el scroll se queda "a medias" en vez de al fondo.
  // Solo se reajusta si el usuario ya estaba abajo; si subió a leer historial, no se lo lleva.
  useEffect(() => {
    const contenedor = hiloRef.current;
    const contenido = hiloContenidoRef.current;
    if (!contenedor || !contenido) return;
    const observer = new ResizeObserver(() => {
      if (cercaDelFondoRef.current) contenedor.scrollTop = contenedor.scrollHeight;
    });
    observer.observe(contenido);
    return () => observer.disconnect();
  }, [detalle?.id, vistaHilo]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionada || !nuevoTexto.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      await api(`/mensajes/conversaciones/${seleccionada}/mensajes`, {
        method: "POST",
        body: JSON.stringify({ contenido: nuevoTexto.trim() }),
      });
      setNuevoTexto("");
      refrescarDetalle();
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  }

  function insertarEmoji(emoji: string) {
    setNuevoTexto((t) => t + emoji);
    inputTextoRef.current?.focus();
  }

  async function eliminarMensaje(mensajeId: string) {
    if (!seleccionada || !(await confirmDialog("¿Eliminar este mensaje de tu bandeja? Esto no lo borra de WhatsApp, solo de aquí."))) return;
    try {
      await api(`/mensajes/conversaciones/${seleccionada}/mensajes/${mensajeId}`, { method: "DELETE" });
      refrescarDetalle();
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el mensaje");
    }
  }

  async function eliminarConversacion(conversacionId: string) {
    if (!(await confirmDialog("¿Eliminar esta conversación de tu bandeja? Esto no la borra de WhatsApp, solo de aquí."))) return;
    try {
      await api(`/mensajes/conversaciones/${conversacionId}`, { method: "DELETE" });
      setConversaciones((prev) => prev.filter((c) => c.id !== conversacionId));
      if (seleccionada === conversacionId) setSeleccionada(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la conversación");
    }
  }

  async function vincularCliente(clienteId: string) {
    if (!seleccionada) return;
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/cliente`, {
        method: "PATCH", body: JSON.stringify({ clienteId: clienteId || null }),
      });
      setDetalle(actualizada);
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el cliente");
    }
  }

  async function vincularLead(leadId: string) {
    if (!seleccionada) return;
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/lead`, {
        method: "PATCH", body: JSON.stringify({ leadId: leadId || null }),
      });
      setDetalle(actualizada);
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el lead");
    }
  }

  function desvincularContacto() {
    if (detalle?.cliente) vincularCliente("");
    else if (detalle?.lead) vincularLead("");
  }

  async function crearLeadDesdeChat(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionada) return;
    setCreandoLead(true);
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/lead`, {
        method: "POST", body: JSON.stringify({ nombre: nombreNuevoLead.trim() || undefined }),
      });
      setDetalle(actualizada);
      setAbrirCrearLead(false);
      cargarConversaciones();
      api<LeadLite[]>("/leads").then(setLeads).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el lead");
    } finally {
      setCreandoLead(false);
    }
  }

  async function cambiarEtapa(etapa: string) {
    if (!seleccionada) return;
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/etapa`, {
        method: "PATCH", body: JSON.stringify({ etapa }),
      });
      setDetalle(actualizada);
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la etapa");
    }
  }

  async function cambiarEstado(estado: string) {
    if (!seleccionada) return;
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/estado`, {
        method: "PATCH", body: JSON.stringify({ estado }),
      });
      setDetalle(actualizada);
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    }
  }

  async function asignar(membershipId: string) {
    if (!seleccionada) return;
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/asignado`, {
        method: "PATCH", body: JSON.stringify({ membershipId: membershipId || null }),
      });
      setDetalle(actualizada);
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar la conversación");
    }
  }

  async function alternarBot(pausado: boolean) {
    if (!seleccionada) return;
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/bot`, {
        method: "PATCH", body: JSON.stringify({ pausado }),
      });
      setDetalle(actualizada);
      cargarConversaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado del bot");
    }
  }

  async function agregarNota(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionada || !notaTexto.trim()) return;
    setGuardandoNota(true);
    try {
      const actualizada = await api<ConversacionDetalle>(`/mensajes/conversaciones/${seleccionada}/notas`, {
        method: "POST", body: JSON.stringify({ contenido: notaTexto.trim() }),
      });
      setDetalle(actualizada);
      setNotaTexto("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la nota");
    } finally {
      setGuardandoNota(false);
    }
  }

  async function crearActividadDesdeChat(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionada || !detalle || !asuntoActividad.trim()) return;
    setCreandoActividad(true);
    try {
      await api("/actividades", {
        method: "POST",
        body: JSON.stringify({
          tipo: tipoActividad,
          asunto: asuntoActividad.trim(),
          vencimiento: vencimientoActividad ? new Date(vencimientoActividad).toISOString() : undefined,
          conversacionId: seleccionada,
          clienteId: detalle.cliente?.id,
          leadId: detalle.lead?.id,
        }),
      });
      setAsuntoActividad("");
      setVencimientoActividad("");
      cargarActividadesConv(seleccionada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la actividad");
    } finally {
      setCreandoActividad(false);
    }
  }

  async function marcarActividadConv(id: string, completada: boolean) {
    if (!seleccionada) return;
    try {
      await api(`/actividades/${id}`, { method: "PATCH", body: JSON.stringify({ completada }) });
      cargarActividadesConv(seleccionada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la actividad");
    }
  }

  async function eliminarActividadConv(id: string) {
    if (!seleccionada || !(await confirmDialog("¿Eliminar esta actividad?"))) return;
    try {
      await api(`/actividades/${id}`, { method: "DELETE" });
      cargarActividadesConv(seleccionada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la actividad");
    }
  }

  async function iniciarConversacion(e: React.FormEvent) {
    e.preventDefault();
    if (!numeroNuevo.trim()) return;
    try {
      const c = await api<Conversacion>("/mensajes/conversaciones", { method: "POST", body: JSON.stringify({ numero: numeroNuevo.trim() }) });
      setAbrirNueva(false);
      setNumeroNuevo("");
      await cargarConversaciones();
      setSeleccionada(c.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la conversación");
    }
  }

  const estadoInfo = etiquetasEfectivas(etiquetasEstado);
  const pipelineLista = pipelineEfectivo(pipelineEtapas);
  const pipelineMap = new Map(pipelineLista.map((e) => [e.id, e]));
  const tieneContacto = !!(detalle?.cliente || detalle?.lead);
  const etapaActual = (detalle && etapaConversacion(detalle)) || pipelineLista[0].id;
  const conversacionesAsignadasAMi = conversaciones.filter((c) => c.asignadoA?.user.email === sesion?.email).length;

  const conversacionesFiltradas = conversaciones.filter((c) => {
    if (filtroEstado !== "TODAS" && c.estado !== filtroEstado) return false;
    if (soloAsignadasAMi && c.asignadoA?.user.email !== sesion?.email) return false;
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return (nombreConversacion(c) ?? "").toLowerCase().includes(q) || c.contactoId.includes(q);
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Mensajes</h1>
          <p className="mt-1 text-sm text-muted">Inbox unificado de tus canales conectados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAbrirNueva(!abrirNueva)} className="btn-primary px-4 py-2 text-sm">
            <Plus size={14} /> Nueva conversación
          </button>
        </div>
      </div>

      {whatsappConectado === false && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          No tienes WhatsApp Business (API oficial) conectado. <Link href="/configuracion" className="font-medium underline underline-offset-2">Ve a Configuración → Integraciones</Link> para conectarlo.
        </p>
      )}

      {abrirNueva && (
        <form onSubmit={iniciarConversacion} className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-foreground">Número de WhatsApp (con código de país)</span>
            <input
              value={numeroNuevo}
              onChange={(e) => setNumeroNuevo(e.target.value)}
              placeholder="593999999999"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <button className="btn-primary px-4 py-2 text-sm">Iniciar</button>
          <p className="w-full text-[11px] text-muted">
            Nota: por la API oficial solo se puede escribir primero a alguien que no te escribió en las últimas 24 h con una plantilla aprobada — un texto libre puede ser rechazado por Meta.
          </p>
        </form>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"><MensajeError mensaje={error} /></p>}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ height: "calc(100vh - 260px)" }}>
        {/* Lista de conversaciones */}
        <div className="card flex flex-col overflow-hidden lg:col-span-1">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar conversación…"
                className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
            {(["TODAS", "ABIERTA", "PENDIENTE", "RESUELTA"] as const).map((v) => {
              const cantidad = v === "TODAS" ? conversaciones.length : conversaciones.filter((c) => c.estado === v).length;
              const activo = filtroEstado === v;
              return (
                <button
                  key={v}
                  onClick={() => setFiltroEstado(v)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    activo ? "bg-primary text-white" : "text-muted hover:bg-surface"
                  }`}
                >
                  {v === "TODAS" ? "Todas" : estadoInfo[v].label}
                  {cantidad > 0 && (
                    <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${activo ? "bg-white/25" : "bg-surface"}`}>
                      {cantidad}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="mx-1 h-4 w-px shrink-0 bg-border" />
            <button
              onClick={() => setSoloAsignadasAMi((v) => !v)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                soloAsignadasAMi ? "bg-primary text-white" : "text-muted hover:bg-surface"
              }`}
            >
              Asignadas a mí
              {conversacionesAsignadasAMi > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${soloAsignadasAMi ? "bg-white/25" : "bg-surface"}`}>
                  {conversacionesAsignadasAMi}
                </span>
              )}
            </button>
          </div>
          {conversacionesFiltradas.length === 0 ? (
            <div className="p-4"><EmptyState texto={conversaciones.length === 0 ? "Sin conversaciones todavía. Conecta un canal en Configuración o inicia una nueva." : "Sin resultados para tu búsqueda."} /></div>
          ) : (
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {conversacionesFiltradas.map((c) => {
                const ultimo = c.mensajes[0];
                const nombre = nombreConversacion(c);
                const etapa = etapaConversacion(c);
                return (
                  <li key={c.id} className="group relative">
                    <button
                      onClick={() => setSeleccionada(c.id)}
                      className={`flex w-full items-center gap-3 py-3 pl-4 pr-10 text-left transition ${seleccionada === c.id ? "bg-primary-soft" : "hover:bg-surface"}`}
                    >
                      <Avatar nombre={nombre} contactoId={c.contactoId} canal={c.canal} fotoUrl={c.fotoUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">{nombre ?? c.contactoId}</p>
                            {etapa && pipelineMap.get(etapa) && <EtapaBadge info={pipelineMap.get(etapa)!} />}
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                            {c.asignadoA && (
                              <span
                                title={`Asignado a ${c.asignadoA.user.nombre}`}
                                className="flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[8px] font-bold text-foreground ring-1 ring-border"
                              >
                                {iniciales(c.asignadoA.user.nombre) || "?"}
                              </span>
                            )}
                            {fechaCorta(c.ultimoMensajeEn)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                            style={{ backgroundColor: `${CANAL_COLOR[c.canal]}1f`, color: CANAL_COLOR[c.canal] }}
                          >
                            {CANAL_LABEL[c.canal]}
                          </span>
                          <EstadoBadge label={estadoInfo[c.estado].label} color={estadoInfo[c.estado].color} />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-xs ${c.noLeidos > 0 ? "font-medium text-foreground" : "text-muted"}`}>
                            {previewTexto(ultimo) ?? CANAL_LABEL[c.canal]}
                          </p>
                          {c.noLeidos > 0 && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">{c.noLeidos}</span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); eliminarConversacion(c.id); }}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-1.5 text-muted opacity-0 transition hover:bg-card hover:text-red-600 group-hover:opacity-100"
                      title="Eliminar conversación"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Hilo */}
        <div className="card flex flex-col overflow-hidden lg:col-span-2">
          {!detalle ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <MessageCircle size={26} />
              </span>
              <p className="text-sm font-medium text-foreground">Selecciona una conversación</p>
              <p className="max-w-xs text-xs text-muted">O inicia una nueva desde el botón de arriba para escribirle a un número directamente.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nombre={nombreConversacion(detalle)} contactoId={detalle.contactoId} canal={detalle.canal} fotoUrl={detalle.fotoUrl} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{nombreConversacion(detalle) ?? detalle.contactoId}</p>
                      <p className="text-xs text-muted">{CANAL_LABEL[detalle.canal]} · {detalle.contactoId}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => alternarBot(!detalle.botPausado)}
                      title={detalle.botPausado ? "El bot no interviene en este chat — click para reactivarlo" : "El bot puede responder en este chat — click para pausarlo"}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                        detalle.botPausado
                          ? "border-border text-muted hover:border-primary/40 hover:text-primary"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      <Bot size={13} /> {detalle.botPausado ? "Bot pausado" : "Bot activo"}
                    </button>
                    <select
                      value={detalle.estado}
                      onChange={(e) => cambiarEstado(e.target.value)}
                      title="Estado de la conversación"
                      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium outline-none focus:border-primary"
                      style={{ color: estadoInfo[detalle.estado].color }}
                    >
                      {Object.entries(estadoInfo).map(([v, info]) => <option key={v} value={v}>{info.label}</option>)}
                    </select>
                    <select
                      value={detalle.asignadoA?.id ?? ""}
                      onChange={(e) => asignar(e.target.value)}
                      title="Asignar a un miembro del equipo"
                      className="max-w-[8rem] rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="">Sin asignar</option>
                      {miembros.map((m) => <option key={m.id} value={m.id}>{m.user.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <select
                      value={detalle.cliente ? `c:${detalle.cliente.id}` : detalle.lead ? `l:${detalle.lead.id}` : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { desvincularContacto(); return; }
                        if (v[0] === "c") vincularCliente(v.slice(2)); else vincularLead(v.slice(2));
                      }}
                      title="Vincular esta conversación a un cliente o lead del CRM"
                      className="max-w-[10rem] rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="">Sin vincular</option>
                      {clientes.length > 0 && (
                        <optgroup label="Clientes">
                          {clientes.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.razonSocial}</option>)}
                        </optgroup>
                      )}
                      {leads.length > 0 && (
                        <optgroup label="Leads">
                          {leads.map((l) => <option key={l.id} value={`l:${l.id}`}>{l.nombre}</option>)}
                        </optgroup>
                      )}
                    </select>
                    {!tieneContacto && !abrirCrearLead && (
                      <button
                        onClick={() => {
                          setNombreNuevoLead(nombreConversacion(detalle) ?? detalle.contactoId);
                          setAbrirCrearLead(true);
                        }}
                        title="Crear un lead a partir de este contacto y vincularlo"
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted transition hover:border-primary hover:text-primary"
                      >
                        <UserPlus2 size={13} /> Crear lead
                      </button>
                    )}
                  </div>
                  <select
                    value={etapaActual}
                    onChange={(e) => cambiarEtapa(e.target.value)}
                    disabled={!tieneContacto}
                    title={tieneContacto ? "Etapa del pipeline" : "Vincula un cliente o lead para poder asignarle una etapa"}
                    className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    style={tieneContacto ? { color: pipelineMap.get(etapaActual)?.color } : undefined}
                  >
                    {pipelineLista.map((info) => <option key={info.id} value={info.id}>{info.label}</option>)}
                  </select>
                </div>
                {abrirCrearLead && (
                  <form onSubmit={crearLeadDesdeChat} className="mt-2 flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={nombreNuevoLead}
                      onChange={(e) => setNombreNuevoLead(e.target.value)}
                      placeholder="Nombre del lead"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setAbrirCrearLead(false)}
                      className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-surface"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={creandoLead || !nombreNuevoLead.trim()}
                      className="btn-primary shrink-0 px-2.5 py-1.5 text-xs disabled:opacity-50"
                    >
                      {creandoLead ? "Creando…" : "Crear lead"}
                    </button>
                  </form>
                )}
              </div>
              <div className="flex border-b border-border">
                <button
                  onClick={() => setVistaHilo("chat")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition ${
                    vistaHilo === "chat" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  <MessageCircle size={13} /> Mensajes
                </button>
                <button
                  onClick={() => setVistaHilo("notas")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition ${
                    vistaHilo === "notas" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  <StickyNote size={13} /> Notas internas{detalle.notas.length > 0 && ` (${detalle.notas.length})`}
                </button>
                <button
                  onClick={() => setVistaHilo("actividades")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition ${
                    vistaHilo === "actividades" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  <CalendarClock size={13} /> Actividades{actividadesConv.length > 0 && ` (${actividadesConv.length})`}
                </button>
              </div>
              {vistaHilo === "actividades" ? (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {actividadesConv.length === 0 ? (
                      <EmptyState texto="Sin actividades para este chat todavía. Agenda una llamada, tarea o recordatorio abajo — también aparecerá en tu Calendario." />
                    ) : (
                      <div className="space-y-2">
                        {actividadesConv.map((a) => (
                          <div key={a.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
                            <input
                              type="checkbox"
                              checked={a.completada}
                              onChange={(e) => marcarActividadConv(a.id, e.target.checked)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="badge-pill shrink-0">{etiquetaTipoActividad(a.tipo)}</span>
                                <p className={`truncate text-sm font-medium ${a.completada ? "text-muted line-through" : "text-foreground"}`}>{a.asunto}</p>
                              </div>
                              {a.vencimiento && (
                                <p className="mt-1 text-xs text-muted">
                                  {new Date(a.vencimiento).toLocaleString("es-EC", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => eliminarActividadConv(a.id)}
                              className="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-red-600"
                              title="Eliminar actividad"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <form onSubmit={crearActividadDesdeChat} className="space-y-2 border-t border-border p-3">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={tipoActividad}
                        onChange={(e) => setTipoActividad(e.target.value as TipoActividad)}
                        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      >
                        {TIPOS_ACTIVIDAD.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                      <input
                        type="datetime-local"
                        value={vencimientoActividad}
                        onChange={(e) => setVencimientoActividad(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={asuntoActividad}
                        onChange={(e) => setAsuntoActividad(e.target.value)}
                        placeholder="Ej. Llamar el miércoles a las 9:00am"
                        className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                      <button
                        disabled={creandoActividad || !asuntoActividad.trim()}
                        className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-50"
                        title="Agendar actividad"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </form>
                </>
              ) : vistaHilo === "notas" ? (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {detalle.notas.length === 0 ? (
                      <EmptyState texto="Sin notas internas todavía. Déjale contexto a quien retome este chat — no se envían al contacto." />
                    ) : (
                      <div className="space-y-3">
                        {detalle.notas.map((n) => (
                          <div key={n.id} className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/20">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">{n.autorNombre}</span>
                              <span className="text-[10px] text-muted">{fechaCorta(n.createdAt)} · {hora(n.createdAt)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{n.contenido}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <form onSubmit={agregarNota} className="flex items-center gap-2 border-t border-border p-3">
                    <input
                      value={notaTexto}
                      onChange={(e) => setNotaTexto(e.target.value)}
                      placeholder="Escribe una nota interna (no se envía al contacto)…"
                      className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                    <button disabled={guardandoNota || !notaTexto.trim()} className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-50">
                      <Send size={16} />
                    </button>
                  </form>
                </>
              ) : (
              <>
              <div ref={hiloRef} className="flex-1 overflow-y-auto px-4 py-3">
                <div ref={hiloContenidoRef}>
                {detalle.mensajes.length === 0 ? (
                  <EmptyState texto="Todavía no hay mensajes en esta conversación." />
                ) : (
                  detalle.mensajes.map((m, i) => {
                    const anterior = detalle.mensajes[i - 1];
                    const nuevoDia = !anterior || new Date(anterior.enviadoEn).toDateString() !== new Date(m.enviadoEn).toDateString();
                    const agrupado = !nuevoDia && anterior?.direccion === m.direccion
                      && (+new Date(m.enviadoEn) - +new Date(anterior.enviadoEn)) < 2 * 60 * 1000;
                    const saliente = m.direccion === "SALIENTE";
                    return (
                      <div key={m.id}>
                        {nuevoDia && (
                          <div className="my-3 flex justify-center">
                            <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-medium text-muted ring-1 ring-border">{etiquetaDia(m.enviadoEn)}</span>
                          </div>
                        )}
                        <div className={`group flex items-center gap-1.5 ${saliente ? "justify-end" : "justify-start"} ${agrupado ? "mt-0.5" : "mt-2.5"}`}>
                          {saliente && (
                            <button
                              onClick={() => eliminarMensaje(m.id)}
                              className="shrink-0 rounded-full p-1.5 text-muted opacity-0 transition hover:bg-surface hover:text-red-600 group-hover:opacity-100"
                              title="Eliminar mensaje"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <div
                            className={`max-w-[75%] px-3 py-2 text-sm ${
                              saliente
                                ? `bg-primary text-white rounded-2xl rounded-br-md ${agrupado ? "rounded-tr-md" : ""}`
                                : `bg-surface text-foreground rounded-2xl rounded-bl-md ${agrupado ? "rounded-tl-md" : ""}`
                            }`}
                          >
                            {m.tipo === "TEXTO" ? (
                              <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words" title="Adjunto de WhatsApp — todavía no se puede abrir desde el CRM">
                                <span className="opacity-80">{PREVIEW_TIPO[m.tipo]}</span>
                                {!CONTENIDO_GENERICO.has(m.contenido) && ` · ${m.contenido}`}
                              </p>
                            )}
                            <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${saliente ? "text-white/70" : "text-muted"}`}>
                              {hora(m.enviadoEn)}
                              {saliente && <Check size={11} />}
                            </p>
                          </div>
                          {!saliente && (
                            <button
                              onClick={() => eliminarMensaje(m.id)}
                              className="shrink-0 rounded-full p-1.5 text-muted opacity-0 transition hover:bg-surface hover:text-red-600 group-hover:opacity-100"
                              title="Eliminar mensaje"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
              <form onSubmit={enviar} className="flex items-center gap-1.5 border-t border-border p-3">
                <div className="flex flex-1 items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-1">
                  <EmojiPicker onSelect={insertarEmoji} />
                  <input
                    ref={inputTextoRef}
                    value={nuevoTexto}
                    onChange={(e) => setNuevoTexto(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none"
                  />
                </div>
                <button disabled={enviando || !nuevoTexto.trim()} className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-50" title="Enviar">
                  <Send size={16} />
                </button>
              </form>
              </>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
