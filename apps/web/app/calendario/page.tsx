"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, AlertTriangle, CalendarClock, CalendarDays, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Kpi } from "@/components/crm-widgets";
import { api } from "@/lib/api";
import { type Actividad, TIPO_ICONO, TIPO_ICONO_DEFAULT, TIPO_COLOR, COLOR_OTROS, diaCalendario } from "@/lib/crm";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TIPOS = [
  { v: "TAREA", l: "Tarea" },
  { v: "LLAMADA", l: "Llamada" },
  { v: "EMAIL", l: "Email" },
  { v: "REUNION", l: "Reunión" },
  { v: "NOTA", l: "Nota" },
].map((t) => ({ ...t, icon: TIPO_ICONO[t.v] ?? TIPO_ICONO_DEFAULT, hex: TIPO_COLOR[t.v] ?? COLOR_OTROS }));
const tipoInfo = (v: string) => TIPOS.find((t) => t.v === v) ?? TIPOS[0];

function generarCalendario(cursor: Date): Date[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const offsetInicio = (primerDia.getDay() + 6) % 7; // lunes = 0
  const dias: Date[] = [];
  for (let i = offsetInicio; i > 0; i--) dias.push(new Date(year, month, 1 - i));
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(year, month, d));
  const offsetFin = (7 - (dias.length % 7)) % 7;
  for (let i = 1; i <= offsetFin; i++) dias.push(new Date(year, month + 1, i));
  return dias;
}

const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function fechaISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatoLargo(d: Date) {
  const s = d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CalendarioPage() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [nuevoAsunto, setNuevoAsunto] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("TAREA");
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const cargar = () => api<Actividad[]>("/actividades").then(setActividades).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const dias = useMemo(() => generarCalendario(cursor), [cursor]);
  const mesActual = cursor.getMonth();

  const actividadesFiltradas = useMemo(
    () => (filtroTipo === "TODOS" ? actividades : actividades.filter((a) => a.tipo === filtroTipo)),
    [actividades, filtroTipo],
  );

  const porDia = useMemo(() => {
    const m = new Map<string, Actividad[]>();
    for (const a of actividadesFiltradas) {
      if (!a.vencimiento) continue;
      const fin = diaCalendario(a.vencimiento);
      const inicio = a.inicio ? diaCalendario(a.inicio) : fin;
      const diffDias = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
      // Rango inválido o sospechosamente largo (dato mal cargado): mostrar solo el día de vencimiento.
      if (diffDias < 0 || diffDias > 60) {
        m.set(claveDia(fin), [...(m.get(claveDia(fin)) ?? []), a]);
        continue;
      }
      const cur = new Date(inicio);
      while (cur <= fin) {
        m.set(claveDia(cur), [...(m.get(claveDia(cur)) ?? []), a]);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [actividadesFiltradas]);

  const sinFecha = useMemo(
    () => actividadesFiltradas.filter((a) => !a.vencimiento && !a.completada),
    [actividadesFiltradas],
  );

  const vencidas = actividades.filter((a) => !a.completada && a.vencimiento && diaCalendario(a.vencimiento) < inicioHoy).length;
  const paraHoy = actividades.filter((a) => !a.completada && a.vencimiento && diaCalendario(a.vencimiento).getTime() === inicioHoy.getTime()).length;
  const en7dias = new Date(inicioHoy); en7dias.setDate(en7dias.getDate() + 7);
  const estaSemana = actividades.filter((a) => !a.completada && a.vencimiento && diaCalendario(a.vencimiento) >= inicioHoy && diaCalendario(a.vencimiento) <= en7dias).length;
  const totalSinFecha = actividades.filter((a) => !a.completada && !a.vencimiento).length;

  const kpis = [
    { icon: AlertTriangle, titulo: "Vencidas", valor: vencidas, color: "#e0433d" },
    { icon: CalendarClock, titulo: "Para hoy", valor: paraHoy, color: "#eda100" },
    { icon: CalendarDays, titulo: "Esta semana", valor: estaSemana, color: "#2a78d6" },
    { icon: ListChecks, titulo: "Sin fecha", valor: totalSinFecha, color: "#7c5cfc" },
  ];

  async function marcar(id: string, completada: boolean) {
    try {
      await api(`/actividades/${id}`, { method: "PATCH", body: JSON.stringify({ completada }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function crearRapida(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!diaSeleccionado || !nuevoAsunto.trim()) return;
    setError(null);
    setGuardandoNuevo(true);
    try {
      await api("/actividades", {
        method: "POST",
        body: JSON.stringify({ tipo: nuevoTipo, asunto: nuevoAsunto.trim(), vencimiento: fechaISO(diaSeleccionado) }),
      });
      setNuevoAsunto("");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardandoNuevo(false);
    }
  }

  const itemsDelDia = diaSeleccionado ? porDia.get(claveDia(diaSeleccionado)) ?? [] : [];

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Calendario</h1>
          <p className="mt-1 text-sm text-muted">Vencimientos de tus actividades — llamadas, tareas, reuniones y más.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="w-40 text-center font-display text-sm font-semibold text-foreground">
            {(() => {
              const s = cursor.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
              return s.charAt(0).toUpperCase() + s.slice(1);
            })()}
          </span>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground"
          >
            Hoy
          </button>
          <button onClick={() => setDiaSeleccionado(new Date())} className="btn-primary px-4 py-2 text-sm">
            + Nueva actividad
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={k.color} />
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setFiltroTipo("TODOS")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
            filtroTipo === "TODOS" ? "bg-primary text-white ring-primary" : "bg-card text-muted ring-border hover:text-foreground"
          }`}
        >
          Todos los tipos
        </button>
        {TIPOS.map((t) => {
          const Icon = t.icon;
          const activo = filtroTipo === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setFiltroTipo(t.v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                activo ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"
              }`}
              style={activo ? { backgroundColor: t.hex } : undefined}
            >
              <Icon size={12} /> {t.l}
            </button>
          );
        })}
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d, i) => {
            const enMes = d.getMonth() === mesActual;
            const esHoy = d.toDateString() === hoy.toDateString();
            const items = porDia.get(claveDia(d)) ?? [];
            const hayVencidas = d < inicioHoy && items.some((a) => !a.completada);
            return (
              <button
                type="button"
                key={i}
                onClick={() => setDiaSeleccionado(d)}
                className={`min-h-[104px] border-b border-r border-border p-1.5 text-left transition last:border-r-0 hover:bg-surface/70 ${enMes ? "" : "bg-surface/50"}`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      esHoy ? "bg-primary text-white" : enMes ? "text-foreground" : "text-muted/50"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {hayVencidas && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="Hay actividades vencidas" />}
                </span>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((a) => {
                    const t = tipoInfo(a.tipo);
                    const Icon = t.icon;
                    return (
                      <div
                        key={a.id}
                        title={a.asunto}
                        className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${a.completada ? "opacity-50 line-through" : ""}`}
                        style={{ backgroundColor: `color-mix(in srgb, ${t.hex} 10%, transparent)`, color: t.hex }}
                      >
                        <Icon size={9} className="shrink-0" />
                        <span className="truncate">{a.asunto}</span>
                      </div>
                    );
                  })}
                  {items.length > 3 && (
                    <p className="px-1.5 text-[10px] font-medium text-muted">+{items.length - 3} más</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {sinFecha.length > 0 && (
        <div className="card mt-4 p-5">
          <h2 className="font-display text-base font-bold text-foreground">Sin fecha de vencimiento</h2>
          <ul className="mt-3 space-y-1.5">
            {sinFecha.map((a) => {
              const t = tipoInfo(a.tipo);
              const Icon = t.icon;
              return (
                <li key={a.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm hover:bg-surface/60">
                  <input
                    type="checkbox"
                    checked={a.completada}
                    onChange={(e) => marcar(a.id, e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-border text-primary"
                  />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${t.hex} 10%, transparent)`, color: t.hex }}>
                    <Icon size={13} />
                  </span>
                  <span className="truncate text-foreground">{a.asunto}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {actividades.length === 0 && <div className="mt-4"><EmptyState texto="No tienes actividades registradas todavía." /></div>}

      {diaSeleccionado && (
        <div
          role="presentation"
          onClick={() => setDiaSeleccionado(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <CalendarDays size={16} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-semibold text-foreground">{formatoLargo(diaSeleccionado)}</h2>
                  <p className="text-xs text-muted">
                    {itemsDelDia.length === 0 ? "Sin actividades" : `${itemsDelDia.length} actividad${itemsDelDia.length === 1 ? "" : "es"}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setDiaSeleccionado(null)} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {itemsDelDia.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted">
                    <CalendarDays size={18} />
                  </span>
                  <p className="text-sm text-muted">Sin actividades este día. Agrega una abajo.</p>
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {itemsDelDia.map((a) => {
                    const t = tipoInfo(a.tipo);
                    const Icon = t.icon;
                    return (
                      <label key={a.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition hover:bg-surface/60">
                        <input
                          type="checkbox"
                          checked={a.completada}
                          onChange={(e) => marcar(a.id, e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-border text-primary"
                        />
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: a.completada ? "#a1a1aa" : t.hex }}
                        >
                          <Icon size={12} />
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${a.completada ? "text-muted line-through" : "text-foreground"}`}>{a.asunto}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-surface/60 px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Agregar actividad rápida</p>
              <form onSubmit={crearRapida}>
                <div className="flex items-center gap-1.5">
                  {TIPOS.map((t) => {
                    const Icon = t.icon;
                    const activo = nuevoTipo === t.v;
                    return (
                      <button
                        type="button"
                        key={t.v}
                        onClick={() => setNuevoTipo(t.v)}
                        title={t.l}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition ${
                          activo ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"
                        }`}
                        style={activo ? { backgroundColor: t.hex } : undefined}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                  <span className="ml-1 text-xs text-muted">{tipoInfo(nuevoTipo).l}</span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <input
                    value={nuevoAsunto}
                    onChange={(e) => setNuevoAsunto(e.target.value)}
                    placeholder="Ej. Llamar para cerrar propuesta"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <button disabled={guardandoNuevo || !nuevoAsunto.trim()} className="btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-50">
                    {guardandoNuevo ? "…" : "Agregar"}
                  </button>
                </div>
              </form>

              <Link href="/actividades" className="mt-3 block text-center text-xs font-medium text-primary hover:underline">
                Ver y editar todas en Actividades →
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
