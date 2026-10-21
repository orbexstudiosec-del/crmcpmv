"use client";

import { useMemo, useState, useEffect } from "react";
import { Bell, Check, UserPlus, Workflow, MessageCircle, Bot as BotIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Kpi } from "@/components/crm-widgets";
import { api } from "@/lib/api";
import { tiempoRelativo, NOTIF_ICONO, NOTIF_COLOR, NOTIF_LABEL, type TipoNotificacion } from "@/lib/crm";

interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string | null;
  url: string | null;
  leida: boolean;
  createdAt: string;
}

const TIPOS: TipoNotificacion[] = [
  "LEAD_NUEVO", "LEAD_CONVERTIDO", "MENSAJE_NUEVO", "BOT_ACTIVADO",
  "CITA_AGENDADA",
];

export default function NotificacionesPage() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "no_leidas">("todas");
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | TipoNotificacion>("TODOS");

  const cargar = () =>
    api<{ items: Notificacion[]; noLeidas: number }>("/notificaciones?limite=200")
      .then((r) => setNotificaciones(r.items))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
  }, []);

  async function abrir(n: Notificacion) {
    if (!n.leida) {
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      api(`/notificaciones/${n.id}/leer`, { method: "POST" }).catch(() => {});
    }
    if (n.url) router.push(n.url);
  }

  function marcarTodasLeidas() {
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
    api("/notificaciones/leer-todas", { method: "POST" }).catch(() => {});
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const kpis = [
    { icon: Bell, titulo: "Total", valor: notificaciones.length, color: "#2a78d6" },
    { icon: UserPlus, titulo: "Leads nuevos", valor: notificaciones.filter((n) => n.tipo === "LEAD_NUEVO").length, color: NOTIF_COLOR.LEAD_NUEVO },
    { icon: Workflow, titulo: "Convertidos", valor: notificaciones.filter((n) => n.tipo === "LEAD_CONVERTIDO").length, color: NOTIF_COLOR.LEAD_CONVERTIDO },
    { icon: MessageCircle, titulo: "Mensajes", valor: notificaciones.filter((n) => n.tipo === "MENSAJE_NUEVO").length, color: NOTIF_COLOR.MENSAJE_NUEVO },
  ];

  const visibles = useMemo(() => {
    return notificaciones.filter((n) => {
      if (filtro === "no_leidas" && n.leida) return false;
      if (filtroTipo !== "TODOS" && n.tipo !== filtroTipo) return false;
      return true;
    });
  }, [notificaciones, filtro, filtroTipo]);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Notificaciones</h1>
          <p className="mt-1 text-sm text-muted">Todo lo que ocurrió en tu CRM: leads, conversiones, mensajes y bots.</p>
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodasLeidas} className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-sm">
            <Check size={14} /> Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={k.color} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(["todas", "no_leidas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filtro === f ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"}`}
            >
              {f === "todas" ? "Todas" : `No leídas${noLeidas > 0 ? ` (${noLeidas})` : ""}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFiltroTipo("TODOS")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
              filtroTipo === "TODOS" ? "bg-primary text-white ring-primary" : "bg-card text-muted ring-border hover:text-foreground"
            }`}
          >
            Todos los tipos
          </button>
          {TIPOS.map((t) => {
            const activo = filtroTipo === t;
            return (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  activo ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"
                }`}
                style={activo ? { backgroundColor: NOTIF_COLOR[t] } : undefined}
              >
                {NOTIF_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Cargando…</p>
        ) : notificaciones.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted">
            <Bell size={22} className="mx-auto mb-2 text-muted/60" />
            Aún no hay notificaciones
          </div>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Ninguna notificación coincide con el filtro</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibles.map((n) => {
              const Icon = NOTIF_ICONO[n.tipo] ?? BotIcon;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => abrir(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface/60 ${!n.leida ? "bg-primary-soft/20" : ""}`}
                  >
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in srgb, ${NOTIF_COLOR[n.tipo]} 12%, transparent)`, color: NOTIF_COLOR[n.tipo] }}
                    >
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`truncate text-sm font-medium ${!n.leida ? "text-foreground" : "text-muted"}`}>{n.titulo}</p>
                        {!n.leida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      {n.mensaje && <p className="mt-0.5 truncate text-xs text-muted">{n.mensaje}</p>}
                      <p className="mt-1 text-[11px] text-muted/70">{tiempoRelativo(n.createdAt)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
