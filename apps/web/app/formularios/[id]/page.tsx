"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Share2, Plus, Trash2, X, ChevronUp, ChevronDown, Mail, Building2, StickyNote, MessageSquareText, ClipboardList, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { CompartirModal } from "../page";
import { CampoFormularioInput, INPUT_CLASE, LABEL_CLASE, type TipoCampoFormulario, type CampoLeadFijo } from "@/components/formulario-lead-campo";

interface Campo {
  id?: string;
  tipo: TipoCampoFormulario;
  etiqueta: string;
  obligatorio: boolean;
  opciones?: string[];
  mapeaA?: CampoLeadFijo | null;
}

interface FormularioLead {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  mensajeExito: string | null;
  activo: boolean;
  campos: Campo[];
}

interface LeadCapturado {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  createdAt: string;
}

const TIPO_LABEL: Record<TipoCampoFormulario, string> = {
  TEXTO_CORTO: "Texto corto",
  TEXTO_LARGO: "Texto largo",
  TELEFONO: "Teléfono",
  EMAIL: "Email",
  OPCION_UNICA: "Opción única",
  OPCION_MULTIPLE: "Opción múltiple",
};

const TIENE_OPCIONES: TipoCampoFormulario[] = ["OPCION_UNICA", "OPCION_MULTIPLE"];

const PRESETS: { label: string; icon: typeof Mail; campo: Campo }[] = [
  { label: "Email", icon: Mail, campo: { tipo: "EMAIL", etiqueta: "Email", obligatorio: false, mapeaA: "EMAIL" } },
  { label: "Empresa", icon: Building2, campo: { tipo: "TEXTO_CORTO", etiqueta: "Empresa", obligatorio: false, mapeaA: "EMPRESA" } },
  { label: "Notas", icon: StickyNote, campo: { tipo: "TEXTO_LARGO", etiqueta: "Notas", obligatorio: false, mapeaA: "NOTAS" } },
  { label: "Pregunta libre", icon: MessageSquareText, campo: { tipo: "TEXTO_CORTO", etiqueta: "", obligatorio: false, mapeaA: null } },
];

const MAPEA_A_LABEL: Record<CampoLeadFijo, string> = { EMAIL: "Email", EMPRESA: "Empresa", NOTAS: "Notas", CIUDAD: "Ciudad" };

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FormularioEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [formulario, setFormulario] = useState<FormularioLead | null>(null);
  const [leads, setLeads] = useState<LeadCapturado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [ciudades, setCiudades] = useState<string[]>([]);

  useEffect(() => {
    api<string[]>("/leads/ciudades").then(setCiudades).catch(() => {});
    api<FormularioLead>(`/formularios-lead/${id}`).then(setFormulario).catch((e) => setError(e.message));
    api<LeadCapturado[]>(`/formularios-lead/${id}/leads`).then(setLeads).catch(() => {});
  }, [id]);

  function actualizarCampo(i: number, cambios: Partial<Campo>) {
    if (!formulario) return;
    const campos = formulario.campos.map((c, idx) => (idx === i ? { ...c, ...cambios } : c));
    setFormulario({ ...formulario, campos });
  }

  function agregarCampo(campo: Campo) {
    if (!formulario) return;
    setFormulario({ ...formulario, campos: [...formulario.campos, { ...campo }] });
  }

  function quitarCampo(i: number) {
    if (!formulario) return;
    setFormulario({ ...formulario, campos: formulario.campos.filter((_, idx) => idx !== i) });
  }

  function moverCampo(i: number, dir: -1 | 1) {
    if (!formulario) return;
    const j = i + dir;
    if (j < 0 || j >= formulario.campos.length) return;
    const campos = [...formulario.campos];
    [campos[i], campos[j]] = [campos[j], campos[i]];
    setFormulario({ ...formulario, campos });
  }

  function agregarOpcion(i: number) {
    const campo = formulario?.campos[i];
    if (!campo) return;
    actualizarCampo(i, { opciones: [...(campo.opciones ?? []), ""] });
  }

  function actualizarOpcion(i: number, oi: number, valor: string) {
    const campo = formulario?.campos[i];
    if (!campo) return;
    const opciones = [...(campo.opciones ?? [])];
    opciones[oi] = valor;
    actualizarCampo(i, { opciones });
  }

  function quitarOpcion(i: number, oi: number) {
    const campo = formulario?.campos[i];
    if (!campo) return;
    actualizarCampo(i, { opciones: (campo.opciones ?? []).filter((_, idx) => idx !== oi) });
  }

  async function guardar() {
    if (!formulario) return;
    setError(null);
    setOk(null);
    setGuardando(true);
    try {
      // Descarta opciones vacías (ej. un "+ Añadir opción" que se guardó sin llegar a escribirse) —
      // el backend rechaza strings vacíos en `opciones`.
      const campos = formulario.campos.map((c) => ({
        tipo: c.tipo, etiqueta: c.etiqueta, obligatorio: c.obligatorio, mapeaA: c.mapeaA,
        opciones: (c.opciones ?? []).map((o) => o.trim()).filter((o) => o !== ""),
      }));
      await api(`/formularios-lead/${formulario.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: formulario.nombre,
          descripcion: formulario.descripcion || undefined,
          mensajeExito: formulario.mensajeExito || undefined,
          activo: formulario.activo,
          campos,
        }),
      });
      setOk("Guardado.");
      setTimeout(() => setOk(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  if (!formulario) {
    return (
      <AppShell>
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p> : <p className="text-sm text-muted">Cargando…</p>}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/formularios" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground">
        <ArrowLeft size={13} /> Formularios
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{formulario.nombre || "Formulario"}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCompartiendo(true)} className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            <Share2 size={14} /> Compartir
          </button>
          <button onClick={guardar} disabled={guardando} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      {ok && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{ok}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Editor ─────────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="card p-6">
            <input
              value={formulario.nombre}
              onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
              placeholder="Nombre del formulario"
              className="w-full border-0 border-b-2 border-border bg-transparent px-0 py-2 font-display text-xl font-bold text-foreground outline-none focus:border-primary"
            />
            <input
              value={formulario.descripcion ?? ""}
              onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
              placeholder="Descripción (opcional) — se muestra arriba del formulario público"
              className="mt-2 w-full border-0 border-b border-border bg-transparent px-0 py-1.5 text-sm text-muted outline-none focus:border-primary"
            />

            <p className="mt-5 text-xs text-muted">Nombre y teléfono siempre se piden — son la base del lead. Agrega las preguntas adicionales abajo.</p>

            <div className="mt-4 space-y-3">
              {formulario.campos.map((campo, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5 pt-2">
                      <button type="button" onClick={() => moverCampo(i, -1)} disabled={i === 0} className="text-muted hover:text-foreground disabled:opacity-30"><ChevronUp size={14} /></button>
                      <button type="button" onClick={() => moverCampo(i, 1)} disabled={i === formulario.campos.length - 1} className="text-muted hover:text-foreground disabled:opacity-30"><ChevronDown size={14} /></button>
                    </div>

                    <input
                      value={campo.etiqueta}
                      onChange={(e) => actualizarCampo(i, { etiqueta: e.target.value })}
                      placeholder="Pregunta sin título"
                      className="min-w-0 flex-1 border-0 border-b border-border bg-transparent px-0 py-1.5 text-sm font-medium text-foreground outline-none focus:border-primary"
                    />

                    <select
                      value={campo.tipo} onChange={(e) => actualizarCampo(i, { tipo: e.target.value as TipoCampoFormulario })}
                      disabled={!!campo.mapeaA}
                      className="w-36 shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-60"
                    >
                      {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>

                    <button type="button" onClick={() => quitarCampo(i)} className="mt-1 shrink-0 text-red-500 hover:text-red-600" title="Quitar pregunta"><Trash2 size={15} /></button>
                  </div>

                  {TIENE_OPCIONES.includes(campo.tipo) && (
                    <div className="mt-3 space-y-1.5 pl-6">
                      {(campo.opciones ?? []).map((op, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 border border-border ${campo.tipo === "OPCION_UNICA" ? "rounded-full" : "rounded-[3px]"}`} />
                          <input
                            value={op} onChange={(e) => actualizarOpcion(i, oi, e.target.value)}
                            placeholder={`Opción ${oi + 1}`}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                          />
                          <button type="button" onClick={() => quitarOpcion(i, oi)} className="shrink-0 text-muted hover:text-red-600"><X size={13} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => agregarOpcion(i)} className="inline-flex items-center gap-1 pl-4 text-xs font-medium text-primary hover:underline">
                        <Plus size={12} /> Añadir opción
                      </button>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between pl-6">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={campo.obligatorio} onChange={(e) => actualizarCampo(i, { obligatorio: e.target.checked })} className="h-3.5 w-3.5 rounded border-border" />
                      Obligatorio
                    </label>
                    {campo.mapeaA && <span className="text-[10px] text-muted">Se guarda como &quot;{MAPEA_A_LABEL[campo.mapeaA]}&quot; del lead</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label} type="button" onClick={() => agregarCampo(p.campo)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary/40 hover:text-primary"
                >
                  <Plus size={13} /> <p.icon size={13} /> {p.label}
                </button>
              ))}
              {/* La ciudad decide a qué agencia se envía el lead. Las opciones que ve el público
                  son siempre las ciudades con agencia en ese momento (las resuelve el servidor). */}
              <button
                type="button"
                disabled={ciudades.length < 2 || formulario.campos.some((c) => c.mapeaA === "CIUDAD")}
                title={ciudades.length < 2 ? "Registra primero la ciudad de tus agencias en Equipo" : "El lead se enviará a la agencia de la ciudad que elija"}
                onClick={() => agregarCampo({ tipo: "OPCION_UNICA", etiqueta: "¿En qué ciudad te encuentras?", obligatorio: true, opciones: ciudades, mapeaA: "CIUDAD" })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={13} /> <MapPin size={13} /> Ciudad (envía a la agencia)
              </button>
            </div>
          </div>

          {/* Configuración */}
          <div className="card mt-4 p-5">
            <h2 className="font-display text-sm font-semibold text-foreground">Configuración</h2>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Mensaje de éxito (opcional)</span>
                <input
                  value={formulario.mensajeExito ?? ""} onChange={(e) => setFormulario({ ...formulario, mensajeExito: e.target.value })}
                  placeholder="¡Gracias! Nos pondremos en contacto pronto."
                  className={INPUT_CLASE}
                />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formulario.activo} onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })} className="h-4 w-4 rounded border-border" />
                <span className="text-sm text-foreground">Formulario activo (acepta envíos públicos)</span>
              </label>
            </div>
          </div>

          {/* Leads capturados */}
          <div className="card mt-4 p-5">
            <h2 className="font-display text-sm font-semibold text-foreground">Leads capturados {leads ? `(${leads.length})` : ""}</h2>
            {leads && leads.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Todavía no hay leads capturados por este formulario.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="pb-2 pr-3 font-medium">Nombre</th>
                      <th className="pb-2 pr-3 font-medium">Teléfono</th>
                      <th className="pb-2 pr-3 font-medium">Email</th>
                      <th className="pb-2 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leads?.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-3 text-foreground">{l.nombre}</td>
                        <td className="py-2 pr-3 text-muted">{l.telefono ?? "—"}</td>
                        <td className="py-2 pr-3 text-muted">{l.email ?? "—"}</td>
                        <td className="py-2 text-muted">{fecha(l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Previsualización en vivo ───────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Así lo ve quien escanea el QR o abre el link</p>
          <div className="rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><ClipboardList size={17} /></span>
              <h2 className="truncate font-display text-lg font-bold text-foreground">{formulario.nombre || "Formulario sin título"}</h2>
            </div>
            {formulario.descripcion && <p className="mt-2 text-sm text-muted">{formulario.descripcion}</p>}

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className={LABEL_CLASE}>Nombre</span>
                <input disabled placeholder="Tu nombre" className={INPUT_CLASE} />
              </label>
              <div className="block">
                <span className={LABEL_CLASE}>Teléfono / WhatsApp</span>
                <div className="flex gap-2">
                  <div className="w-16 shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-muted">+593</div>
                  <input disabled placeholder="99 999 9999" className={`${INPUT_CLASE} min-w-0 flex-1`} />
                </div>
              </div>

              {formulario.campos.map((campo, i) => (
                <CampoFormularioInput
                  key={campo.id ?? i}
                  soloVista
                  campo={{ id: campo.id ?? `preview-${i}`, tipo: campo.tipo, etiqueta: campo.etiqueta, obligatorio: campo.obligatorio, opciones: campo.opciones ?? [] }}
                />
              ))}

              <div className="btn-primary pointer-events-none w-full px-4 py-2.5 text-center text-sm opacity-90">Enviar</div>
            </div>
          </div>
        </div>
      </div>

      {compartiendo && <CompartirModal formulario={formulario} onClose={() => setCompartiendo(false)} />}
    </AppShell>
  );
}
