"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, Pencil, Trash2, ListChecks, AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { Kpi } from "@/components/crm-widgets";
import { api } from "@/lib/api";
import { TIPO_ICONO, TIPO_COLOR, TIPO_ICONO_DEFAULT, COLOR_OTROS, diaCalendario } from "@/lib/crm";

interface Cliente { id: string; razonSocial: string }
interface LeadLite { id: string; nombre: string }
interface OportunidadLite { id: string; titulo: string }

interface Actividad {
  id: string;
  tipo: "LLAMADA" | "EMAIL" | "REUNION" | "TAREA" | "NOTA";
  asunto: string;
  detalle: string | null;
  inicio: string | null;
  vencimiento: string | null;
  completada: boolean;
  clienteId: string | null;
  oportunidadId: string | null;
  leadId: string | null;
}

const TIPOS = [
  { v: "TAREA", l: "Tarea" },
  { v: "LLAMADA", l: "Llamada" },
  { v: "EMAIL", l: "Email" },
  { v: "REUNION", l: "Reunión" },
  { v: "NOTA", l: "Nota" },
].map((t) => ({ ...t, icon: TIPO_ICONO[t.v] ?? TIPO_ICONO_DEFAULT, hex: TIPO_COLOR[t.v] ?? COLOR_OTROS }));
const tipoCfg = (v: string) => TIPOS.find((t) => t.v === v) ?? TIPOS[0];

function inicioDeHoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function finDeHoy() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function estaVencida(a: Actividad) {
  return !a.completada && !!a.vencimiento && diaCalendario(a.vencimiento) < inicioDeHoy();
}
function esHoy(a: Actividad) {
  if (!a.vencimiento) return false;
  const v = diaCalendario(a.vencimiento);
  return v >= inicioDeHoy() && v <= finDeHoy();
}

/** Frases comunes según el tipo de actividad, para no escribir el mismo asunto cada vez. */
const SUGERENCIAS_ASUNTO: Record<string, string[]> = {
  LLAMADA: ["Llamé y mostró interés", "Llamé y pidió más tiempo", "Llamé y no contestó", "Llamé para dar seguimiento"],
  EMAIL: ["Envié seguimiento", "Envié propuesta", "Envié información solicitada"],
  REUNION: ["Reunión de seguimiento", "Demostración del producto", "Visita presencial"],
  TAREA: ["Dar seguimiento", "Preparar propuesta", "Revisar documentación"],
  NOTA: ["Cliente pidió una cotización", "Cliente comparando opciones", "Nota interna"],
};

function CampoAsunto({ tipo, valor, onChange }: { tipo: string; valor: string; onChange: (v: string) => void }) {
  const sugerencias = SUGERENCIAS_ASUNTO[tipo] ?? [];
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">Asunto</span>
      <input
        name="asunto"
        required
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej. Llamar para cerrar propuesta"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      {sugerencias.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {sugerencias.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => onChange(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition ${
                valor === s ? "bg-primary text-white ring-primary" : "bg-surface text-muted ring-border hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function CampoTextArea({ label, className = "", ...p }: { label: string; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <textarea {...p} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
    </label>
  );
}

function SelectorTipo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-foreground">Tipo</span>
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => {
          const Icon = t.icon;
          const activo = valor === t.v;
          return (
            <button
              type="button"
              key={t.v}
              onClick={() => onChange(t.v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition ${
                activo ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"
              }`}
              style={activo ? { backgroundColor: t.hex } : undefined}
            >
              <Icon size={14} /> {t.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function CampoFecha({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  const hoy = new Date();
  const ATAJOS = [
    { l: "Hoy", dias: 0 },
    { l: "Mañana", dias: 1 },
    { l: "En 3 días", dias: 3 },
    { l: "Próxima semana", dias: 7 },
  ];
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <input
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ATAJOS.map((a) => {
          const f = new Date(hoy);
          f.setDate(f.getDate() + a.dias);
          const iso = fechaISO(f);
          const activo = valor === iso;
          return (
            <button
              type="button"
              key={a.l}
              onClick={() => onChange(iso)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition ${
                activo ? "bg-primary text-white ring-primary" : "bg-surface text-muted ring-border hover:text-foreground"
              }`}
            >
              {a.l}
            </button>
          );
        })}
        {valor && (
          <button type="button" onClick={() => onChange("")} className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted hover:text-red-600">
            Quitar fecha
          </button>
        )}
      </div>
    </div>
  );
}

type VinculoTipo = "NINGUNO" | "CLIENTE" | "LEAD" | "OPORTUNIDAD";
const OPCIONES_VINCULO: { v: VinculoTipo; l: string }[] = [
  { v: "NINGUNO", l: "Ninguno" },
  { v: "CLIENTE", l: "Cliente" },
  { v: "LEAD", l: "Lead" },
  { v: "OPORTUNIDAD", l: "Oportunidad" },
];

function SelectorVinculo({
  tipo, id, onTipoChange, onIdChange, clientes, leads, oportunidades,
}: {
  tipo: VinculoTipo;
  id: string;
  onTipoChange: (v: VinculoTipo) => void;
  onIdChange: (v: string) => void;
  clientes: Cliente[];
  leads: LeadLite[];
  oportunidades: OportunidadLite[];
}) {
  const lista =
    tipo === "CLIENTE" ? clientes.map((c) => ({ id: c.id, l: c.razonSocial })) :
    tipo === "LEAD" ? leads.map((l) => ({ id: l.id, l: l.nombre })) :
    tipo === "OPORTUNIDAD" ? oportunidades.map((o) => ({ id: o.id, l: o.titulo })) : [];
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-foreground">Vincular a</span>
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES_VINCULO.map((o) => (
          <button
            type="button"
            key={o.v}
            onClick={() => { onTipoChange(o.v); onIdChange(""); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
              tipo === o.v ? "bg-primary text-white ring-primary" : "bg-card text-muted ring-border hover:text-foreground"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
      {tipo !== "NINGUNO" && (
        <select
          value={id}
          onChange={(e) => onIdChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Selecciona…</option>
          {lista.map((x) => <option key={x.id} value={x.id}>{x.l}</option>)}
        </select>
      )}
    </div>
  );
}

export default function ActividadesPage() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [oportunidades, setOportunidades] = useState<OportunidadLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState<"pendientes" | "todas">("pendientes");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Actividad | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [tipoCrear, setTipoCrear] = useState("TAREA");
  const [asuntoCrear, setAsuntoCrear] = useState("");
  const [inicioCrear, setInicioCrear] = useState("");
  const [vencimientoCrear, setVencimientoCrear] = useState("");
  const [vinculoTipoCrear, setVinculoTipoCrear] = useState<VinculoTipo>("NINGUNO");
  const [vinculoIdCrear, setVinculoIdCrear] = useState("");

  const [tipoEditar, setTipoEditar] = useState("TAREA");
  const [asuntoEditar, setAsuntoEditar] = useState("");
  const [inicioEditar, setInicioEditar] = useState("");
  const [vencimientoEditar, setVencimientoEditar] = useState("");
  const [vinculoTipoEditar, setVinculoTipoEditar] = useState<VinculoTipo>("NINGUNO");
  const [vinculoIdEditar, setVinculoIdEditar] = useState("");

  const cargar = () => api<Actividad[]>("/actividades").then(setActividades).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    api<Cliente[]>("/clientes").then(setClientes).catch(() => {});
    api<LeadLite[]>("/leads").then(setLeads).catch(() => {});
    api<OportunidadLite[]>("/oportunidades").then(setOportunidades).catch(() => {});
  }, []);

  function alternarNuevo() {
    setAbierto((v) => {
      if (!v) {
        setTipoCrear("TAREA");
        setAsuntoCrear("");
        setInicioCrear("");
        setVencimientoCrear("");
        setVinculoTipoCrear("NINGUNO");
        setVinculoIdCrear("");
      }
      return !v;
    });
  }

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("/actividades", {
        method: "POST",
        body: JSON.stringify({
          tipo: tipoCrear,
          asunto: f.get("asunto"),
          detalle: f.get("detalle") || undefined,
          inicio: inicioCrear || undefined,
          vencimiento: vencimientoCrear || undefined,
          clienteId: vinculoTipoCrear === "CLIENTE" ? (vinculoIdCrear || undefined) : undefined,
          leadId: vinculoTipoCrear === "LEAD" ? (vinculoIdCrear || undefined) : undefined,
          oportunidadId: vinculoTipoCrear === "OPORTUNIDAD" ? (vinculoIdCrear || undefined) : undefined,
        }),
      });
      setAbierto(false);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  async function marcar(id: string, completada: boolean) {
    try {
      await api(`/actividades/${id}`, { method: "PATCH", body: JSON.stringify({ completada }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function abrirEdicion(a: Actividad) {
    setEditando(a);
    setTipoEditar(a.tipo);
    setAsuntoEditar(a.asunto);
    setInicioEditar(a.inicio ? a.inicio.slice(0, 10) : "");
    setVencimientoEditar(a.vencimiento ? a.vencimiento.slice(0, 10) : "");
    if (a.clienteId) { setVinculoTipoEditar("CLIENTE"); setVinculoIdEditar(a.clienteId); }
    else if (a.leadId) { setVinculoTipoEditar("LEAD"); setVinculoIdEditar(a.leadId); }
    else if (a.oportunidadId) { setVinculoTipoEditar("OPORTUNIDAD"); setVinculoIdEditar(a.oportunidadId); }
    else { setVinculoTipoEditar("NINGUNO"); setVinculoIdEditar(""); }
  }

  async function guardarEdicion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    setError(null);
    setGuardandoEdicion(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(`/actividades/${editando.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tipo: tipoEditar,
          asunto: f.get("asunto"),
          detalle: f.get("detalle") ?? "",
          inicio: inicioEditar,
          vencimiento: vencimientoEditar,
          clienteId: vinculoTipoEditar === "CLIENTE" ? vinculoIdEditar : "",
          leadId: vinculoTipoEditar === "LEAD" ? vinculoIdEditar : "",
          oportunidadId: vinculoTipoEditar === "OPORTUNIDAD" ? vinculoIdEditar : "",
        }),
      });
      setEditando(null);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function eliminar(id: string) {
    if (!(await confirmDialog("¿Eliminar esta actividad?"))) return;
    try {
      await api(`/actividades/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  const vinculo = (a: Actividad) => {
    const cliente = a.clienteId && clientes.find((c) => c.id === a.clienteId)?.razonSocial;
    const lead = a.leadId && leads.find((l) => l.id === a.leadId)?.nombre;
    const op = a.oportunidadId && oportunidades.find((o) => o.id === a.oportunidadId)?.titulo;
    return cliente || lead || op || null;
  };

  const subtitulo = (a: Actividad) => {
    const vencida = estaVencida(a);
    const fmt = (iso: string) => diaCalendario(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
    const partes: string[] = [];
    const link = vinculo(a);
    if (link) partes.push(link);
    if (a.inicio) partes.push(`inicia ${fmt(a.inicio)}`);
    if (a.vencimiento) partes.push(`${vencida ? "venció" : "vence"} ${fmt(a.vencimiento)}`);
    if (!a.inicio && !a.vencimiento) partes.push("sin fecha");
    return partes.join(" · ");
  };

  const pendientes = actividades.filter((a) => !a.completada).length;
  const vencidas = actividades.filter(estaVencida).length;
  const hoy = actividades.filter((a) => !a.completada && esHoy(a)).length;
  const completadas = actividades.filter((a) => a.completada).length;

  const kpis = [
    { icon: ListChecks, titulo: "Pendientes", valor: pendientes, color: "#2a78d6" },
    { icon: AlertTriangle, titulo: "Vencidas", valor: vencidas, color: "#e0433d" },
    { icon: CalendarClock, titulo: "Para hoy", valor: hoy, color: "#eda100" },
    { icon: CheckCircle2, titulo: "Completadas", valor: completadas, color: "#1baf7a" },
  ];

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return actividades.filter((a) => {
      if (filtro === "pendientes" && a.completada) return false;
      if (filtroTipo !== "TODOS" && a.tipo !== filtroTipo) return false;
      if (!q) return true;
      return [a.asunto, a.detalle, vinculo(a)].some((v) => v?.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividades, filtro, filtroTipo, busqueda, clientes, leads, oportunidades]);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Actividades</h1>
          <p className="mt-1 text-sm text-muted">Tareas, llamadas y seguimiento de tus clientes, leads y oportunidades.</p>
        </div>
        <button onClick={alternarNuevo} className="btn-primary px-4 py-2 text-sm">
          {abierto ? "Cancelar" : "+ Nueva actividad"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={k.color} />
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

      {abierto && (
        <form onSubmit={crear} className="card mt-4 flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Nueva actividad</h2>
            <p className="text-xs text-muted">Registra una tarea, llamada, reunión o seguimiento pendiente.</p>
          </div>
          <SelectorTipo valor={tipoCrear} onChange={setTipoCrear} />
          <CampoAsunto tipo={tipoCrear} valor={asuntoCrear} onChange={setAsuntoCrear} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoFecha label="Inicio (opcional)" valor={inicioCrear} onChange={setInicioCrear} />
            <CampoFecha label="Vencimiento" valor={vencimientoCrear} onChange={setVencimientoCrear} />
          </div>
          <CampoTextArea name="detalle" label="Detalle (opcional)" rows={2} />
          <SelectorVinculo
            tipo={vinculoTipoCrear}
            id={vinculoIdCrear}
            onTipoChange={setVinculoTipoCrear}
            onIdChange={setVinculoIdCrear}
            clientes={clientes}
            leads={leads}
            oportunidades={oportunidades}
          />
          <button disabled={guardando} className="btn-primary self-start px-5 py-2 text-sm disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar actividad"}
          </button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por asunto, detalle o vínculo…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-1.5">
          {(["pendientes", "todas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filtro === f ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"}`}
            >
              {f === "pendientes" ? "Pendientes" : "Todas"}
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
            const activo = filtroTipo === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setFiltroTipo(t.v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  activo ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"
                }`}
                style={activo ? { backgroundColor: t.hex } : undefined}
              >
                {t.l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        {actividades.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted">
            <ListChecks size={22} className="mx-auto mb-2 text-muted/60" />
            Aún no tienes actividades registradas
          </div>
        ) : visibles.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted">Ninguna actividad coincide con la búsqueda o el filtro.</p>
            <button
              onClick={() => { setFiltro("pendientes"); setFiltroTipo("TODOS"); setBusqueda(""); }}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              Quitar filtros
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visibles.map((a) => {
              const t = tipoCfg(a.tipo);
              const Icon = t.icon;
              const vencida = estaVencida(a);
              return (
                <li
                  key={a.id}
                  onClick={() => abrirEdicion(a)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-surface/60"
                >
                  <input
                    type="checkbox"
                    checked={a.completada}
                    onChange={(e) => marcar(a.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 shrink-0 rounded border-border text-primary"
                  />
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: a.completada ? "#a1a1aa" : t.hex }}
                  >
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${a.completada ? "text-muted line-through" : "text-foreground"}`}>{a.asunto}</p>
                    <p className={`truncate text-xs ${vencida ? "font-medium text-red-600 dark:text-red-400" : "text-muted"}`}>
                      {subtitulo(a)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); abrirEdicion(a); }} title="Editar" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); eliminar(a.id); }}
                      title="Eliminar"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editando && (
        <div
          role="presentation"
          onClick={() => setEditando(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-lg p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">Editar actividad</h2>
            <form key={editando.id} onSubmit={guardarEdicion} className="mt-4 flex flex-col gap-4">
              <SelectorTipo valor={tipoEditar} onChange={setTipoEditar} />
              <CampoAsunto tipo={tipoEditar} valor={asuntoEditar} onChange={setAsuntoEditar} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CampoFecha label="Inicio (opcional)" valor={inicioEditar} onChange={setInicioEditar} />
                <CampoFecha label="Vencimiento" valor={vencimientoEditar} onChange={setVencimientoEditar} />
              </div>
              <CampoTextArea name="detalle" label="Detalle (opcional)" defaultValue={editando.detalle ?? ""} rows={2} />
              <SelectorVinculo
                tipo={vinculoTipoEditar}
                id={vinculoIdEditar}
                onTipoChange={setVinculoTipoEditar}
                onIdChange={setVinculoIdEditar}
                clientes={clientes}
                leads={leads}
                oportunidades={oportunidades}
              />
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setEditando(null)} className="btn-outline px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button disabled={guardandoEdicion} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
