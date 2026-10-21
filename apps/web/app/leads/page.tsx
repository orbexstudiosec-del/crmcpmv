"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Pencil, Trash2, MessageCircle, Mail, ArrowUpRight, Users, UserPlus, Sparkles, Percent, HelpCircle, X, ChevronDown, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { Kpi } from "@/components/crm-widgets";
import { api } from "@/lib/api";
import { ACENTOS_KPI } from "@/lib/crm";
import { PAISES, telefonoCompleto, dividirTelefono, whatsappUrl, type TelefonoValor } from "@/lib/paises";

interface Lead {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  fuente: string | null;
  estado: "NUEVO" | "CONTACTADO" | "CALIFICADO" | "DESCARTADO" | "CONVERTIDO";
  notas: string | null;
  ciudad: string | null;
  sucursal: { id: string; nombre: string } | null;
}

interface Agencia { id: string; nombre: string; ciudad: string | null }

/** Valores especiales del selector de agencia (los demás son ids de agencia). */
const AGENCIA_AUTO = "__auto__";
const AGENCIA_NINGUNA = "__ninguna__";

const ESTADOS = [
  { v: "NUEVO", l: "Nuevo", c: "bg-sky-50 text-sky-700 ring-sky-200", hex: "#0284c7", desc: "Acaba de entrar y todavía no se le contacta." },
  { v: "CONTACTADO", l: "Contactado", c: "bg-amber-50 text-amber-700 ring-amber-200", hex: "#d97706", desc: "Ya hubo un primer acercamiento (llamada, mensaje, correo)." },
  { v: "CALIFICADO", l: "Calificado", c: "bg-violet-50 text-violet-700 ring-violet-200", hex: "#7c3aed", desc: "Cumple el perfil y muestra intención real de compra." },
  { v: "DESCARTADO", l: "Descartado", c: "bg-zinc-100 text-zinc-600 ring-zinc-200", hex: "#71717a", desc: "No es un prospecto viable por ahora; sale del embudo." },
  { v: "CONVERTIDO", l: "Convertido", c: "bg-emerald-50 text-emerald-700 ring-emerald-200", hex: "#059669", desc: "Ya se transformó en una oportunidad de venta." },
] as const;
const estadoCfg = (v: string) => ESTADOS.find((e) => e.v === v) ?? ESTADOS[0];

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

function Campo({ label, className = "", ...p }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <input {...p} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
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

function SelectorPais({ pais, onChange }: { pais: string; onChange: (dial: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const actual = PAISES.find((p) => p.dial === pais) ?? PAISES[0];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Código de país"
        className="flex h-[2.375rem] w-[6.5rem] items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary"
      >
        <span className={`fi fi-${actual.iso.toLowerCase()} rounded-[2px]`} />
        <span className="truncate">{actual.dial}</span>
        <ChevronDown size={13} className="ml-auto shrink-0 text-muted" />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-60 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
            {PAISES.map((p) => (
              <button
                type="button"
                key={p.iso}
                onClick={() => { onChange(p.dial); setAbierto(false); }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface ${
                  p.iso === actual.iso ? "bg-primary-soft text-primary" : "text-foreground"
                }`}
              >
                <span className={`fi fi-${p.iso.toLowerCase()} rounded-[2px]`} />
                <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                <span className="shrink-0 text-muted">{p.dial}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CampoTelefono({
  label, valor, onChange, className = "",
}: { label: string; valor: TelefonoValor; onChange: (v: TelefonoValor) => void; className?: string }) {
  return (
    <div className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <div className="flex gap-2">
        <SelectorPais pais={valor.pais} onChange={(dial) => onChange({ ...valor, pais: dial })} />
        <input
          type="tel"
          inputMode="tel"
          value={valor.numero}
          onChange={(e) => onChange({ ...valor, numero: e.target.value.replace(/[^\d\s-]/g, "") })}
          placeholder="99 999 9999"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <p className="mt-1 text-[11px] text-muted">Se usa para escribirle directo por WhatsApp desde la lista de leads.</p>
    </div>
  );
}

/** Ciudad del prospecto: decide a qué agencia se envía. Sugiere las ciudades que ya cubre
 *  alguna agencia, pero deja escribir otra (quedará sin agencia hasta asignarla a mano). */
function CampoCiudad({ ciudades, defaultValue, className = "" }: { ciudades: string[]; defaultValue?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-foreground">Ciudad</span>
      <input
        name="ciudad"
        list="ciudades-agencia"
        defaultValue={defaultValue}
        placeholder="Ej. Tulcán, Ibarra, Quito…"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <datalist id="ciudades-agencia">
        {ciudades.map((c) => <option key={c} value={c} />)}
      </datalist>
      <span className="mt-1 block text-[11px] text-muted">El lead se envía a la agencia que atiende esta ciudad.</span>
    </label>
  );
}

const TELEFONO_VACIO: TelefonoValor = { pais: "+593", numero: "" };
const FILTROS = [{ v: "TODOS", l: "Todos" }, ...ESTADOS.map((e) => ({ v: e.v, l: e.l }))];

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [telCrear, setTelCrear] = useState<TelefonoValor>(TELEFONO_VACIO);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [telEditar, setTelEditar] = useState<TelefonoValor>(TELEFONO_VACIO);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [filtroAgencia, setFiltroAgencia] = useState("TODAS");

  const cargar = () => api<Lead[]>("/leads").then(setLeads).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    api<Agencia[]>("/sucursales").then(setAgencias).catch(() => {});
    api<string[]>("/leads/ciudades").then(setCiudades).catch(() => {});
  }, []);

  function alternarNuevo() {
    setAbierto((v) => {
      if (!v) setTelCrear(TELEFONO_VACIO);
      return !v;
    });
  }

  function abrirEdicion(l: Lead) {
    setEditando(l);
    setTelEditar(dividirTelefono(l.telefono));
  }

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("/leads", {
        method: "POST",
        body: JSON.stringify({
          nombre: f.get("nombre"),
          email: f.get("email") || undefined,
          telefono: telefonoCompleto(telCrear.pais, telCrear.numero),
          empresa: f.get("empresa") || undefined,
          ciudad: f.get("ciudad") || undefined,
          fuente: f.get("fuente") || undefined,
          notas: f.get("notas") || undefined,
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

  async function cambiarEstado(id: string, estado: string) {
    try {
      await api(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function guardarEdicion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    setError(null);
    setGuardandoEdicion(true);
    const f = new FormData(e.currentTarget);
    // "Automática" no manda agencia: el servidor la recalcula si cambió la ciudad.
    const agencia = String(f.get("agencia"));
    const sucursalId = agencia === AGENCIA_AUTO ? undefined : agencia === AGENCIA_NINGUNA ? null : agencia;
    try {
      await api(`/leads/${editando.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: f.get("nombre"),
          email: f.get("email") || undefined,
          telefono: telefonoCompleto(telEditar.pais, telEditar.numero),
          empresa: f.get("empresa") || undefined,
          ciudad: String(f.get("ciudad") ?? ""),
          sucursalId,
          fuente: f.get("fuente") || undefined,
          notas: f.get("notas") || undefined,
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

  async function convertir(id: string, nombre: string) {
    setError(null);
    try {
      await api(`/leads/${id}/convertir`, { method: "POST", body: JSON.stringify({}) });
      setOk(`"${nombre}" se convirtió en oportunidad.`);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function eliminar(id: string) {
    if (!(await confirmDialog("¿Eliminar este lead?"))) return;
    try {
      await api(`/leads/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  const totalLeads = leads.length;
  const nuevos = leads.filter((l) => l.estado === "NUEVO").length;
  const calificados = leads.filter((l) => l.estado === "CALIFICADO").length;
  const convertidos = leads.filter((l) => l.estado === "CONVERTIDO").length;
  const tasaConversion = totalLeads > 0 ? Math.round((convertidos / totalLeads) * 100) : 0;

  const kpis = [
    { icon: Users, titulo: "Total de leads", valor: totalLeads },
    { icon: UserPlus, titulo: "Nuevos", valor: nuevos },
    { icon: Sparkles, titulo: "Calificados", valor: calificados },
    { icon: Percent, titulo: "Tasa de conversión", valor: `${tasaConversion}%` },
  ];

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return leads.filter((l) => {
      if (filtroEstado !== "TODOS" && l.estado !== filtroEstado) return false;
      if (filtroAgencia === AGENCIA_NINGUNA ? l.sucursal : filtroAgencia !== "TODAS" && l.sucursal?.id !== filtroAgencia) return false;
      if (!q) return true;
      return [l.nombre, l.empresa, l.email, l.telefono, l.fuente, l.ciudad, l.sucursal?.nombre].some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, busqueda, filtroEstado, filtroAgencia]);

  const sinAgencia = leads.filter((l) => !l.sucursal).length;

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted">Prospectos por calificar antes de entrar al embudo de ventas.</p>
        </div>
        <button onClick={alternarNuevo} className="btn-primary px-4 py-2 text-sm">
          {abierto ? "Cancelar" : "+ Nuevo lead"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k, i) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={ACENTOS_KPI[i % ACENTOS_KPI.length]} />
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
      {ok && (
        <p className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10">
          {ok}
          <button onClick={() => router.push("/oportunidades")} className="font-semibold underline">Ver oportunidades</button>
        </p>
      )}

      {abierto && (
        <form onSubmit={crear} className="card mt-4 grid grid-cols-2 gap-3 p-5">
          <Campo name="nombre" label="Nombre" required />
          <Campo name="empresa" label="Empresa" />
          <Campo name="email" label="Email" type="email" />
          <CampoTelefono label="Teléfono / WhatsApp" valor={telCrear} onChange={setTelCrear} />
          <CampoCiudad ciudades={ciudades} className="col-span-2" />
          <Campo name="fuente" label="Fuente" className="col-span-2" placeholder="Ej. Activación BTL — Feria Norte, Formulario web…" />
          <CampoTextArea name="notas" label="Notas" className="col-span-2" rows={2} placeholder="Contexto adicional sobre este prospecto…" />
          <button disabled={guardando} className="btn-primary col-span-2 px-4 py-2 text-sm disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar lead"}
          </button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, ciudad, agencia, email o teléfono…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const activo = filtroEstado === f.v;
            const cuenta = f.v === "TODOS" ? leads.length : leads.filter((l) => l.estado === f.v).length;
            return (
              <button
                key={f.v}
                onClick={() => setFiltroEstado(f.v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  activo ? "bg-primary text-white ring-primary" : "bg-card text-muted ring-border hover:text-foreground"
                }`}
              >
                {f.l} <span className={activo ? "text-white/80" : "text-muted/70"}>({cuenta})</span>
              </button>
            );
          })}
        </div>

        {agencias.length > 0 && (
          <select
            value={filtroAgencia}
            onChange={(e) => setFiltroAgencia(e.target.value)}
            aria-label="Filtrar por agencia"
            className="rounded-full border-0 bg-card px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border outline-none focus:ring-primary"
          >
            <option value="TODAS">Todas las agencias</option>
            {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            <option value={AGENCIA_NINGUNA}>Sin agencia ({sinAgencia})</option>
          </select>
        )}

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setGuiaAbierta((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-border hover:text-foreground"
          >
            <HelpCircle size={13} /> ¿Qué significa cada estado?
          </button>

          {guiaAbierta && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setGuiaAbierta(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Guía de estados</p>
                  <button onClick={() => setGuiaAbierta(false)} className="text-muted hover:text-foreground" aria-label="Cerrar">
                    <X size={14} />
                  </button>
                </div>
                <ul className="mt-2 space-y-2.5">
                  {ESTADOS.map((e) => (
                    <li key={e.v} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.hex }} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{e.l}</p>
                        <p className="text-[11px] leading-snug text-muted">{e.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden overflow-x-auto rounded-2xl bg-card shadow-sm ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {["Lead", "Contacto", "Ciudad y agencia", "Fuente", "Estado", ""].map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">
                <Users size={22} className="mx-auto mb-2 text-muted/60" />
                Aún no tienes leads registrados
              </td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Ningún lead coincide con la búsqueda o el filtro</td></tr>
            ) : (
              filtrados.map((l) => {
                const wa = whatsappUrl(l.telefono);
                return (
                  <tr key={l.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: estadoCfg(l.estado).hex }}
                        >
                          {iniciales(l.nombre)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{l.nombre}</p>
                          <p className="truncate text-xs text-muted">{l.empresa ?? "Sin empresa"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {l.email && (
                          <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
                            <Mail size={12} /> {l.email}
                          </a>
                        )}
                        {l.telefono && wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Escribir por WhatsApp"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            <MessageCircle size={12} /> {l.telefono}
                          </a>
                        )}
                        {!l.email && !l.telefono && <span className="text-xs text-muted">—</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {l.sucursal ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground"><MapPin size={12} className="text-primary" /> {l.sucursal.nombre}</span>
                          {l.ciudad && <span className="pl-4 text-[11px] text-muted">{l.ciudad}</span>}
                        </div>
                      ) : (
                        <span
                          title={l.ciudad ? "Ninguna agencia atiende esa ciudad. Asígnala a mano al editar el lead." : "Falta la ciudad del lead."}
                          className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30"
                        >
                          {l.ciudad ? `${l.ciudad} · sin agencia` : "Sin ciudad"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {l.fuente ? (
                        <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs text-muted ring-1 ring-border">{l.fuente}</span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <select
                        value={l.estado}
                        onChange={(e) => cambiarEstado(l.id, e.target.value)}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ring-1 ${estadoCfg(l.estado).c}`}
                      >
                        {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {l.estado !== "CONVERTIDO" && l.estado !== "DESCARTADO" && (
                          <button
                            onClick={() => convertir(l.id, l.nombre)}
                            title="Convertir en oportunidad"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft"
                          >
                            <ArrowUpRight size={13} /> Convertir
                          </button>
                        )}
                        <button onClick={() => abrirEdicion(l)} title="Editar" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => eliminar(l.id)}
                          title="Eliminar"
                          className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <div
          role="presentation"
          onClick={() => setEditando(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="card w-full max-w-lg p-5"
          >
            <h2 className="font-display text-lg font-semibold text-foreground">Editar lead</h2>
            <form key={editando.id} onSubmit={guardarEdicion} className="mt-4 grid grid-cols-2 gap-3">
              <Campo name="nombre" label="Nombre" defaultValue={editando.nombre} required className="col-span-2" />
              <Campo name="empresa" label="Empresa" defaultValue={editando.empresa ?? ""} />
              <Campo name="email" label="Email" type="email" defaultValue={editando.email ?? ""} />
              <CampoTelefono label="Teléfono / WhatsApp" valor={telEditar} onChange={setTelEditar} className="col-span-2" />
              <CampoCiudad ciudades={ciudades} defaultValue={editando.ciudad ?? ""} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Agencia</span>
                <select
                  name="agencia"
                  defaultValue={AGENCIA_AUTO}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value={AGENCIA_AUTO}>{editando.sucursal ? `${editando.sucursal.nombre} (actual)` : "Automática según la ciudad"}</option>
                  {agencias.filter((a) => a.id !== editando.sucursal?.id).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  {editando.sucursal && <option value={AGENCIA_NINGUNA}>Sin agencia</option>}
                </select>
              </label>
              <Campo name="fuente" label="Fuente" defaultValue={editando.fuente ?? ""} className="col-span-2" />
              <CampoTextArea name="notas" label="Notas" defaultValue={editando.notas ?? ""} className="col-span-2" rows={3} />
              <div className="col-span-2 mt-2 flex justify-end gap-2">
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
