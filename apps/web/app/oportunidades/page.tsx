"use client";

import { useEffect, useState } from "react";
import { X, Inbox } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";
import { Field, Select } from "@/app/clientes/page";
import { pipelineEfectivo, money, type EtapaPipelineDef } from "@/lib/crm";

interface Cliente { id: string; razonSocial: string }
interface LeadLite { id: string; nombre: string }
interface OrganizacionLite { pipelineEtapas: EtapaPipelineDef[] | null }

interface Oportunidad {
  id: string;
  titulo: string;
  etapa: string;
  monto: string;
  probabilidad: number;
  cierreEstimado: string | null;
  createdAt: string;
  updatedAt: string;
  cliente: Cliente | null;
  lead: LeadLite | null;
}

function diasEnEtapa(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "1 día";
  return `${dias} días`;
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaSobre, setColumnaSobre] = useState<string | null>(null);
  const [pipelineEtapas, setPipelineEtapas] = useState<EtapaPipelineDef[] | null>(null);

  const ETAPAS = pipelineEfectivo(pipelineEtapas);

  const cargar = () => api<Oportunidad[]>("/oportunidades").then(setOportunidades).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    api<Cliente[]>("/clientes").then(setClientes).catch(() => {});
    api<LeadLite[]>("/leads").then(setLeads).catch(() => {});
    api<OrganizacionLite>("/organizacion").then((o) => setPipelineEtapas(o.pipelineEtapas)).catch(() => {});
  }, []);

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("/oportunidades", {
        method: "POST",
        body: JSON.stringify({
          titulo: f.get("titulo"),
          clienteId: f.get("clienteId") || undefined,
          leadId: f.get("leadId") || undefined,
          monto: Number(f.get("monto") || 0),
          probabilidad: Number(f.get("probabilidad") || 0),
          cierreEstimado: f.get("cierreEstimado") || undefined,
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

  async function moverEtapa(id: string, etapa: string) {
    const actual = oportunidades.find((o) => o.id === id);
    if (!actual || actual.etapa === etapa) return;
    const previas = oportunidades;
    setOportunidades((prev) => prev.map((o) => (o.id === id ? { ...o, etapa: etapa as Oportunidad["etapa"] } : o)));
    try {
      await api(`/oportunidades/${id}`, { method: "PATCH", body: JSON.stringify({ etapa }) });
      cargar();
    } catch (err) {
      setOportunidades(previas);
      setError(err instanceof Error ? err.message : "No se pudo mover la oportunidad");
    }
  }

  async function eliminar(id: string) {
    if (!(await confirmDialog("¿Eliminar esta oportunidad?"))) return;
    try {
      await api(`/oportunidades/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Oportunidades</h1>
          <p className="mt-1 text-sm text-muted">Tablero Kanban de tu embudo de ventas — arrastra las tarjetas para mover un trato de etapa.</p>
        </div>
        <button onClick={() => setAbierto(!abierto)} className="btn-primary px-4 py-2 text-sm">
          {abierto ? "Cancelar" : "+ Nueva oportunidad"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

      {abierto && (
        <form onSubmit={crear} className="card mt-4 grid grid-cols-2 gap-3 p-5">
          <Field name="titulo" label="Título" required className="col-span-2" />
          <Select name="clienteId" label="Cliente (opcional)">
            <option value="">Sin cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
          </Select>
          <Select name="leadId" label="Lead (opcional)">
            <option value="">Sin lead</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </Select>
          <Field name="monto" label="Monto" type="number" step="0.01" min="0" />
          <Field name="probabilidad" label="Probabilidad (%)" type="number" step="1" min="0" max="100" />
          <Field name="cierreEstimado" label="Cierre estimado" type="date" className="col-span-2" />
          <button disabled={guardando} className="btn-primary col-span-2 px-4 py-2 text-sm disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar oportunidad"}
          </button>
        </form>
      )}

      <div className="mt-6 grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {ETAPAS.map((info) => {
          const etapaKey = info.id;
          const items = oportunidades.filter((o) => o.etapa === etapaKey);
          const total = items.reduce((s, o) => s + Number(o.monto), 0);
          const sobreEstaColumna = columnaSobre === etapaKey;
          return (
            <div key={etapaKey}>
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/60">
                <div className="h-1" style={{ backgroundColor: info.color }} />
                <div className="flex items-center gap-2 px-3 pt-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: info.color }} />
                  <h3 className="text-sm font-semibold text-foreground" title={info.descripcion}>{info.label}</h3>
                  <span
                    className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ backgroundColor: `color-mix(in srgb, ${info.color} 13%, transparent)`, color: info.color }}
                  >
                    {items.length}
                  </span>
                </div>
                <p className="px-3 pb-2.5 pt-0.5 text-xs font-semibold" style={{ color: info.color }}>{money(total)}</p>

                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDragEnter={() => setColumnaSobre(etapaKey)}
                  onDragLeave={(e) => { if (e.currentTarget === e.target) setColumnaSobre(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setColumnaSobre(null);
                    setArrastrando(null);
                    if (id) moverEtapa(id, etapaKey);
                  }}
                  className="min-h-[6rem] space-y-2 rounded-b-2xl p-2 pb-2.5 transition-colors duration-150"
                  style={sobreEstaColumna ? { backgroundColor: `color-mix(in srgb, ${info.color} 8%, transparent)`, boxShadow: `inset 0 0 0 2px ${info.color}` } : undefined}
                >
                  {items.map((o) => {
                    const vencida = !!o.cierreEstimado && new Date(o.cierreEstimado) < new Date() && info.tipo === "ABIERTA";
                    const nombreVinculo = o.cliente?.razonSocial ?? o.lead?.nombre ?? null;
                    return (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", o.id); setArrastrando(o.id); }}
                        onDragEnd={() => setArrastrando(null)}
                        className={`card cursor-grab p-3 transition-all duration-150 active:cursor-grabbing ${
                          arrastrando === o.id ? "scale-95 opacity-60 shadow-lg" : "hover:-translate-y-0.5 hover:shadow-md"
                        }`}
                        style={{ borderLeft: `3px solid ${info.color}` }}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: info.color }}
                          >
                            {iniciales(nombreVinculo ?? "?")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-snug text-foreground">{o.titulo}</p>
                              <button onClick={() => eliminar(o.id)} className="shrink-0 text-muted hover:text-red-600" aria-label="Eliminar">
                                <X size={14} />
                              </button>
                            </div>
                            <p className="truncate text-xs text-muted">{nombreVinculo ?? "Sin vincular"}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{money(Number(o.monto))}</span>
                          <span className="text-xs font-medium text-muted">{o.probabilidad}%</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full" style={{ width: `${o.probabilidad}%`, backgroundColor: info.color }} />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted">
                          <span>{diasEnEtapa(o.updatedAt)} en esta etapa</span>
                          {o.cierreEstimado && (
                            <span className={vencida ? "font-semibold text-red-600" : undefined}>
                              {new Date(o.cierreEstimado).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        <select
                          value={o.etapa}
                          onChange={(e) => moverEtapa(o.id, e.target.value)}
                          className="mt-2.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                        >
                          {ETAPAS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border/80 py-6 text-center">
                      <Inbox size={18} className="text-muted/60" />
                      <p className="text-xs text-muted">Sin oportunidades</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
