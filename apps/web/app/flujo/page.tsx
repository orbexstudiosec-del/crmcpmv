"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  MessageCircle, Instagram, Facebook, Music2, ClipboardList, UserPlus, Inbox, Bot, MapPin,
  Filter, Workflow, ListChecks, Trophy, XCircle, Megaphone, BarChart3, UsersRound, ArrowRight,
  ChevronDown, PhoneCall,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

type Chip = { label: string; href?: string };

interface Etapa {
  n: number;
  titulo: string;
  resumen: string;
  icon: LucideIcon;
  detalle: string[];
  modulos: Chip[];
  quien: string;
}

/** Los canales por los que un interesado puede llegar. El estado refleja lo realmente operativo. */
const CANALES: { label: string; icon: LucideIcon; estado: "listo" | "pronto"; nota: string }[] = [
  { label: "WhatsApp", icon: MessageCircle, estado: "listo", nota: "Código QR o API oficial" },
  { label: "Formulario web / QR", icon: ClipboardList, estado: "listo", nota: "Link o código QR en campañas" },
  { label: "Registro manual", icon: PhoneCall, estado: "listo", nota: "Un asesor lo ingresa tras una llamada o visita" },
  { label: "Instagram", icon: Instagram, estado: "pronto", nota: "Conexión lista; recepción en camino" },
  { label: "Messenger", icon: Facebook, estado: "pronto", nota: "Conexión lista; recepción en camino" },
  { label: "TikTok", icon: Music2, estado: "pronto", nota: "Conexión lista" },
];

const ETAPAS: Etapa[] = [
  {
    n: 1,
    titulo: "Entra por un canal",
    resumen: "El interesado escribe por WhatsApp, llena un formulario o un asesor lo registra.",
    icon: Inbox,
    detalle: [
      "Si escribe por WhatsApp, su mensaje llega a la bandeja unificada en tiempo real.",
      "Si llena el formulario público (link o QR), se crea directo como prospecto, con la ciudad que eligió.",
      "Un asesor también puede registrarlo a mano después de una llamada, feria o visita.",
    ],
    modulos: [{ label: "Mensajes", href: "/mensajes" }, { label: "Formularios", href: "/formularios" }, { label: "Leads", href: "/leads" }],
    quien: "Lo recibe el sistema automáticamente",
  },
  {
    n: 2,
    titulo: "Conversación en la bandeja",
    resumen: "Todo lo que llega por los canales cae en un solo lugar: Mensajes.",
    icon: MessageCircle,
    detalle: [
      "La conversación se puede asignar a un asesor, marcar como Abierta / Pendiente / Resuelta y dejarle notas internas.",
      "Un bot puede responder lo básico (horarios, requisitos) y pasar a un humano cuando hace falta.",
      "Desde la misma conversación se crea el prospecto sin salir de la pantalla.",
    ],
    modulos: [{ label: "Mensajes", href: "/mensajes" }, { label: "Bots", href: "/bots" }],
    quien: "Asesor asignado",
  },
  {
    n: 3,
    titulo: "Se registra como prospecto",
    resumen: "El interesado pasa a ser un prospecto con nombre, teléfono y ciudad.",
    icon: UserPlus,
    detalle: [
      "La ciudad es la clave: decide a qué agencia se envía.",
      "Cada prospecto arranca en estado Nuevo.",
      "Queda guardada su fuente (WhatsApp, formulario, feria…) para medir qué canal trae más gente.",
    ],
    modulos: [{ label: "Leads", href: "/leads" }],
    quien: "Automático o el asesor",
  },
  {
    n: 4,
    titulo: "Se envía a su agencia",
    resumen: "Según la ciudad, el prospecto llega a la agencia que la atiende.",
    icon: MapPin,
    detalle: [
      "Tulcán, Ibarra, Quito, Otavalo y las demás ciudades están mapeadas a sus agencias.",
      "Si una ciudad tiene varias agencias, el prospecto va a la que menos carga tiene, para repartir parejo.",
      "Si ninguna agencia cubre esa ciudad, queda marcado “sin agencia” para que un administrador lo asigne.",
    ],
    modulos: [{ label: "Equipo → Agencias", href: "/equipo" }, { label: "Leads", href: "/leads" }],
    quien: "Automático",
  },
  {
    n: 5,
    titulo: "Se califica",
    resumen: "El asesor de la agencia lo contacta y decide si es un prospecto real.",
    icon: Filter,
    detalle: [
      "El estado avanza: Nuevo → Contactado → Calificado.",
      "Cada asesor solo ve los prospectos de su agencia.",
      "Si no es viable, se marca Descartado y sale del embudo.",
    ],
    modulos: [{ label: "Leads", href: "/leads" }, { label: "Actividades", href: "/actividades" }],
    quien: "Asesor de la agencia",
  },
  {
    n: 6,
    titulo: "Se convierte en oportunidad",
    resumen: "El prospecto calificado entra al embudo de ventas como una oportunidad.",
    icon: Workflow,
    detalle: [
      "La oportunidad se mueve por el tablero (Kanban) con las etapas que la cooperativa configure.",
      "Se le pone un monto estimado y una fecha de cierre.",
      "Es el momento donde se concreta el producto: crédito, ahorro, inversión…",
    ],
    modulos: [{ label: "Oportunidades", href: "/oportunidades" }],
    quien: "Asesor de la agencia",
  },
  {
    n: 7,
    titulo: "Seguimiento hasta el cierre",
    resumen: "Llamadas, reuniones y tareas quedan registradas hasta decidir el resultado.",
    icon: ListChecks,
    detalle: [
      "Cada gestión (llamada, reunión, nota, visita) se registra como actividad con su fecha.",
      "El calendario muestra lo pendiente de cada día.",
      "El panel y los reportes miden cuántos prospectos avanzan y quién los atiende.",
    ],
    modulos: [{ label: "Actividades", href: "/actividades" }, { label: "Calendario", href: "/calendario" }, { label: "Reportes", href: "/reportes" }],
    quien: "Asesor y supervisor",
  },
];

const DESENLACES = [
  { label: "Nuevo socio", icon: Trophy, color: "var(--color-primary)", texto: "La oportunidad se marca Ganada: el interesado se vuelve socio y pasa a Clientes." },
  { label: "No concretó", icon: XCircle, color: "#71717a", texto: "Se marca Perdida o Descartado. Queda el registro para volver a contactarlo más adelante." },
];

const TRANSVERSALES: Chip[] = [
  { label: "Bots", href: "/bots" },
  { label: "Campañas", href: "/campanas" },
  { label: "Reportes", href: "/reportes" },
  { label: "Equipo y agencias", href: "/equipo" },
];
const TRANSVERSAL_ICON: Record<string, LucideIcon> = { Bots: Bot, Campañas: Megaphone, Reportes: BarChart3, "Equipo y agencias": UsersRound };

export default function FlujoPage() {
  const [abierta, setAbierta] = useState<number | null>(1);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <header>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Workflow size={13} /> Cómo funciona
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
            El recorrido de un prospecto, paso a paso
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Desde que una persona interesada contacta a la cooperativa hasta que se convierte en socio, y en qué pantalla ocurre cada paso.
          </p>
        </header>

        {/* Canales de entrada */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Por dónde entra</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CANALES.map((c) => (
              <div key={c.label} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <c.icon size={17} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">{c.label}</p>
                    {c.estado === "pronto" && (
                      <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted ring-1 ring-border">Pronto</span>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-muted">{c.nota}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center text-muted">
            <ChevronDown size={20} />
          </div>
        </section>

        {/* Línea de tiempo de etapas */}
        <section className="relative mt-2">
          {/* Riel vertical */}
          <div aria-hidden className="absolute bottom-4 left-[19px] top-4 w-0.5 bg-gradient-to-b from-primary via-primary/40 to-accent sm:left-[23px]" />

          <ul className="space-y-3">
            {ETAPAS.map((e) => {
              const activa = abierta === e.n;
              return (
                <li key={e.n} className="relative">
                  <button
                    onClick={() => setAbierta(activa ? null : e.n)}
                    className={`flex w-full items-start gap-4 rounded-2xl border bg-card p-4 text-left transition ${
                      activa ? "border-primary/40 shadow-sm ring-1 ring-primary/15" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ring-4 ring-card ${
                      activa ? "bg-primary text-white" : "bg-primary-soft text-primary"
                    }`}>
                      {e.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <e.icon size={16} className="shrink-0 text-primary" />
                        <h3 className="font-display text-base font-bold text-foreground">{e.titulo}</h3>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">{e.resumen}</p>

                      <div className={`grid transition-all duration-300 ${activa ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                          <ul className="space-y-1.5 border-l-2 border-primary-soft pl-3.5">
                            {e.detalle.map((d, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                {d}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-medium text-muted">Dónde:</span>
                            {e.modulos.map((m) => (
                              m.href ? (
                                <Link
                                  key={m.label}
                                  href={m.href}
                                  onClick={(ev) => ev.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-white"
                                >
                                  {m.label} <ArrowRight size={11} />
                                </Link>
                              ) : (
                                <span key={m.label} className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-border">{m.label}</span>
                              )
                            ))}
                            <span className="ml-auto rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted ring-1 ring-border">👤 {e.quien}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`mt-1 shrink-0 text-muted transition-transform ${activa ? "rotate-180" : ""}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Desenlaces */}
        <section className="mt-6">
          <div className="flex justify-center text-muted"><ChevronDown size={20} /></div>
          <h2 className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-muted">¿En qué termina?</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DESENLACES.map((d) => (
              <div key={d.label} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${d.color}1f`, color: d.color }}>
                  <d.icon size={19} />
                </span>
                <div>
                  <p className="font-display font-bold text-foreground">{d.label}</p>
                  <p className="mt-0.5 text-sm text-muted">{d.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Módulos transversales */}
        <section className="mt-8 rounded-2xl bg-gradient-to-br from-navy to-navy-dark p-5 text-white">
          <h2 className="font-display text-base font-bold">Lo que acompaña todo el recorrido</h2>
          <p className="mt-1 text-sm text-white/70">
            Estas herramientas trabajan en varias etapas a la vez: automatizan respuestas, atraen prospectos, miden resultados y organizan al equipo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TRANSVERSALES.map((t) => {
              const Icon = TRANSVERSAL_ICON[t.label];
              return (
                <Link
                  key={t.label}
                  href={t.href!}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
                >
                  <Icon size={15} className="text-accent" /> {t.label}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
