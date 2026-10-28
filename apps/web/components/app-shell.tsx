"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Home, LogOut, UserPlus, Workflow, ListChecks, Search, Bell, Calendar, Megaphone, Settings, Bot,
  ChevronLeft, ChevronRight, Check, ClipboardList, MessageSquare, BarChart3, Users, UsersRound, Route, ShieldCheck,
  CalendarRange,
} from "lucide-react";
import { api, actualizarSesion, cerrarSesion, leerSesion, EVENTO_SESION, type Sesion } from "@/lib/api";
import { useMarca, ICONO, LOGO_BLANCO } from "@/lib/marca";
import { tiempoRelativo, NOTIF_ICONO, type TipoNotificacion } from "@/lib/crm";

const SIDEBAR_KEY = "crm.sidebarColapsado";
const SIDEBAR_ANCHO_EXPANDIDO = "16rem"; // w-64
const SIDEBAR_ANCHO_COLAPSADO = "5rem"; // w-20

// Rutas que puede abrir cada rol restringido. Es un filtro de navegación (UX): la seguridad
// real la dan los guards de rol del backend.
const RUTAS_AGENTE = ["/dashboard", "/notificaciones", "/mensajes", "/leads", "/oportunidades", "/actividades", "/calendario", "/clientes", "/flujo"];
const RUTAS_GERENCIA = ["/dashboard", "/notificaciones", "/reportes", "/flujo", "/riesgos", "/cronopost"];
// Analista de riesgos: su trabajo es el módulo de Riesgos (y ver prospectos).
const RUTAS_RIESGOS = ["/dashboard", "/notificaciones", "/flujo", "/riesgos", "/leads"];

const ROL_LABEL: Record<string, string> = {
  OWNER: "Administrador", ADMIN: "Coadministrador", SUPERVISOR: "Jefe de agencia", AGENTE: "Agente", RIESGOS: "Analista de riesgos", GERENCIA: "Gerencia",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { marca } = useMarca();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [mensajesPendientes, setMensajesPendientes] = useState(0);
  const [colapsado, setColapsado] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    const s = leerSesion();
    if (!s) router.replace("/login");
    else setSesion(s);

    const onSesionCambio = () => setSesion(leerSesion());
    window.addEventListener(EVENTO_SESION, onSesionCambio);
    return () => window.removeEventListener(EVENTO_SESION, onSesionCambio);
  }, [router]);

  const esAgente = sesion?.rol === "AGENTE";
  const esGerencia = sesion?.rol === "GERENCIA";
  const esRiesgos = sesion?.rol === "RIESGOS";
  const rutasPermitidas = esAgente ? RUTAS_AGENTE : esGerencia ? RUTAS_GERENCIA : esRiesgos ? RUTAS_RIESGOS : null;
  const puede = (href: string) => !rutasPermitidas || rutasPermitidas.includes(href);

  // Si un rol restringido entra por URL directa a una sección que no le toca, vuelve al inicio.
  useEffect(() => {
    if (rutasPermitidas && !rutasPermitidas.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
      router.replace("/dashboard");
    }
  }, [rutasPermitidas, pathname, router]);

  useEffect(() => {
    setColapsado(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-width", colapsado ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO_EXPANDIDO);
  }, [colapsado]);

  function alternarColapso() {
    setColapsado((v) => {
      localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1");
      return !v;
    });
  }

  useEffect(() => {
    // Gerencia y riesgos no atienden mensajes (el API les responde 403).
    if (!sesion || sesion.rol === "GERENCIA" || sesion.rol === "RIESGOS") return;
    api<{ estado: string }[]>("/mensajes/conversaciones")
      .then((cs) => setMensajesPendientes(cs.filter((c) => c.estado === "PENDIENTE").length))
      .catch(() => {});
  }, [sesion]);

  // El nombre de la empresa se guarda en la sesión al iniciar; si alguien lo cambió después
  // en Configuración, se actualiza aquí sin obligar a volver a entrar.
  const organizationId = sesion?.organizationId;
  useEffect(() => {
    if (!organizationId) return;
    api<{ nombre: string }>("/organizacion")
      .then((o) => { if (o.nombre !== leerSesion()?.orgNombre) actualizarSesion({ orgNombre: o.nombre }); })
      .catch(() => {});
  }, [organizationId]);

  const cargarNotificaciones = () =>
    api<{ items: Notificacion[]; noLeidas: number }>("/notificaciones")
      .then((r) => { setNotificaciones(r.items); setNoLeidas(r.noLeidas); })
      .catch(() => {});

  useEffect(() => {
    if (!sesion) return;
    cargarNotificaciones();
    const t = setInterval(cargarNotificaciones, 30_000);
    return () => clearInterval(t);
  }, [sesion]);

  if (!sesion) return null;

  const iniciales = sesion.nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const link = (href: string, label: string, icon: LucideIcon, badge?: number) =>
    puede(href) && <NavLink href={href} label={label} icon={icon} pathname={pathname} badge={badge} colapsado={colapsado} />;

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className={`relative flex shrink-0 flex-col bg-gradient-to-b from-navy to-navy-dark transition-[width] duration-200 ease-in-out ${colapsado ? "w-20" : "w-64"}`}>
        <button
          onClick={alternarColapso}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="absolute -right-3 top-7 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted shadow-sm transition hover:text-primary"
        >
          {colapsado ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* Marca */}
        <div className={`border-b border-white/10 py-5 ${colapsado ? "flex justify-center px-2" : "px-5"}`} title={colapsado ? `${marca.nombre} · ${sesion.orgNombre}` : undefined}>
          {/* eslint-disable @next/next/no-img-element -- imágenes de marca: estáticas o data URL de la base */}
          {colapsado ? (
            <img src={marca.icono ?? ICONO} alt={marca.nombre} className="h-9 w-12 object-contain" />
          ) : (
            <>
              <img src={marca.logo ?? LOGO_BLANCO} alt={sesion.orgNombre} className="max-h-12 w-full object-contain object-left" />
              <p className="mt-3 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{marca.nombre}</p>
            </>
          )}
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-3 py-3">
          {link("/dashboard", "Dashboard", Home)}
          {link("/flujo", "Cómo funciona", Route)}
          {link("/notificaciones", "Notificaciones", Bell, noLeidas)}

          {!esGerencia && <Grupo colapsado={colapsado}>CRM</Grupo>}
          {link("/mensajes", "Mensajes", MessageSquare, mensajesPendientes)}
          {link("/leads", "Leads", UserPlus)}
          {link("/formularios", "Formularios", ClipboardList)}
          {link("/oportunidades", "Oportunidades", Workflow)}
          {link("/riesgos", "Riesgos", ShieldCheck)}
          {link("/actividades", "Actividades", ListChecks)}
          {link("/calendario", "Calendario", Calendar)}
          {link("/campanas", "Campañas", Megaphone)}
          {link("/cronopost", "Cronopost", CalendarRange)}
          {link("/bots", "Bots", Bot)}

          <Grupo colapsado={colapsado}>General</Grupo>
          {link("/clientes", "Clientes", Users)}
          {link("/reportes", "Reportes", BarChart3)}
          {link("/equipo", "Equipo", UsersRound)}
          {link("/configuracion", "Configuración", Settings)}
        </nav>

        <div className={`border-t border-white/10 ${colapsado ? "px-2 py-3" : "p-3"}`}>
          <div className={`flex items-center gap-2.5 rounded-xl ${colapsado ? "flex-col py-1" : "bg-white/5 px-3 py-2.5"}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-navy-dark" title={colapsado ? sesion.nombre : undefined}>
              {iniciales}
            </span>
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-white">{sesion.nombre}</p>
                <p className="truncate text-[11px] leading-tight text-white/50">{ROL_LABEL[sesion.rol] ?? sesion.rol}</p>
              </div>
            )}
            <button
              onClick={() => { cerrarSesion(); router.replace("/login"); }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          notificaciones={notificaciones}
          noLeidas={noLeidas}
          setNotificaciones={setNotificaciones}
          setNoLeidas={setNoLeidas}
        />
        <main className="flex-1 overflow-x-hidden px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string | null;
  url: string | null;
  leida: boolean;
  createdAt: string;
}

function TopBar({
  notificaciones, noLeidas, setNotificaciones, setNoLeidas,
}: {
  notificaciones: Notificacion[];
  noLeidas: number;
  setNotificaciones: React.Dispatch<React.SetStateAction<Notificacion[]>>;
  setNoLeidas: React.Dispatch<React.SetStateAction<number>>;
}) {
  const router = useRouter();
  const [notifAbierta, setNotifAbierta] = useState(false);

  async function abrirNotificacion(n: Notificacion) {
    setNotifAbierta(false);
    if (!n.leida) {
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      setNoLeidas((c) => Math.max(0, c - 1));
      api(`/notificaciones/${n.id}/leer`, { method: "POST" }).catch(() => {});
    }
    if (n.url) router.push(n.url);
  }

  function marcarTodasLeidas() {
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
    setNoLeidas(0);
    api("/notificaciones/leer-todas", { method: "POST" }).catch(() => {});
  }

  const hoy = new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="flex items-center gap-4 border-b border-border bg-card px-8 py-3.5">
      <div className="relative max-w-md flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Buscar clientes, leads…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/calendario"
          title={`Calendario — hoy es ${hoy}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground"
        >
          <Calendar size={17} />
        </Link>
        <div className="relative">
          <button
            onClick={() => setNotifAbierta((v) => !v)}
            title="Notificaciones"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground"
          >
            <Bell size={17} />
            {noLeidas > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </button>
          {notifAbierta && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifAbierta(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                  <p className="text-sm font-semibold text-foreground">Notificaciones</p>
                  {noLeidas > 0 && (
                    <button onClick={marcarTodasLeidas} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Check size={12} /> Marcar todas
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted">Sin notificaciones todavía.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {notificaciones.map((n) => {
                        const Icon = NOTIF_ICONO[n.tipo] ?? Bell;
                        return (
                          <li key={n.id}>
                            <button
                              onClick={() => abrirNotificacion(n)}
                              className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-surface/60 ${!n.leida ? "bg-primary-soft/30" : ""}`}
                            >
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                                <Icon size={13} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className={`truncate text-xs font-medium ${!n.leida ? "text-foreground" : "text-muted"}`}>{n.titulo}</span>
                                  {!n.leida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                                </span>
                                {n.mensaje && <span className="mt-0.5 block truncate text-[11px] text-muted">{n.mensaje}</span>}
                                <span className="mt-0.5 block text-[10px] text-muted/70">{tiempoRelativo(n.createdAt)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <Link
                  href="/notificaciones"
                  onClick={() => setNotifAbierta(false)}
                  className="block border-t border-border px-3.5 py-2.5 text-center text-xs font-medium text-primary hover:underline"
                >
                  Ver todas
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Grupo({ children, colapsado }: { children: React.ReactNode; colapsado?: boolean }) {
  if (colapsado) return <div className="mx-2 my-2.5 border-t border-white/10" />;
  return (
    <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{children}</p>
  );
}

function NavLink({
  href, label, icon: Icon, pathname, badge, colapsado,
}: { href: string; label: string; icon: LucideIcon; pathname: string; badge?: number; colapsado?: boolean }) {
  const activo = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      title={colapsado ? label : undefined}
      aria-current={activo ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-lg py-2 text-[13.5px] font-medium transition-colors ${colapsado ? "justify-center px-2" : "px-3"} ${
        activo ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
      }`}
    >
      {/* Marcador de la sección activa, en el color de acento de la marca */}
      {activo && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
      <Icon size={17} className={`shrink-0 transition-colors ${activo ? "text-accent" : "text-white/55 group-hover:text-white"}`} />
      {!colapsado && <span className="flex-1 truncate">{label}</span>}
      {!!badge && (
        colapsado ? (
          <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-navy-dark" />
        ) : (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-navy-dark">
            {badge > 99 ? "99+" : badge}
          </span>
        )
      )}
    </Link>
  );
}