"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send, Users, UserPlus, ClipboardList, Megaphone, CheckCheck, AlertTriangle, Percent, Pencil, Trash2, ChevronDown, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Kpi } from "@/components/crm-widgets";
import { confirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";
import { exportarExcel } from "@/lib/exportar";

type Estado = "BORRADOR" | "PROGRAMADA" | "ENVIANDO" | "ENVIADA";
type PublicoManual = "CLIENTES" | "LEADS" | "LEADS_FORMULARIO";
type Publico = PublicoManual;

const PUBLICO_LABEL: Record<Publico, string> = {
  CLIENTES: "Clientes",
  LEADS: "Leads",
  LEADS_FORMULARIO: "Leads de un formulario",
};

interface Campana {
  id: string;
  nombre: string;
  canal: "EMAIL" | "SMS" | "WHATSAPP";
  estado: Estado;
  mensaje: string | null;
  publico: Publico | null;
  formularioLeadId: string | null;
  plantillaMeta: string | null;
  plantillaMetaIdioma: string | null;
  totalDestinatarios: number;
  enviadaEn: string | null;
  enviados: number;
  createdAt: string;
}

interface FormularioOpcion {
  id: string;
  nombre: string;
}

type EstadoDestinatario = "PENDIENTE" | "ENVIADO" | "ERROR";
interface Destinatario {
  id: string;
  nombre: string;
  telefono: string;
  estado: EstadoDestinatario;
  error: string | null;
  enviadoEn: string | null;
}
const ESTADO_DEST_ESTILO: Record<EstadoDestinatario, string> = {
  PENDIENTE: "bg-surface text-muted ring-1 ring-border",
  ENVIADO: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
  ERROR: "bg-red-50 text-red-600 ring-1 ring-red-200",
};
const ESTADO_DEST_LABEL: Record<EstadoDestinatario, string> = {
  PENDIENTE: "Pendiente",
  ENVIADO: "Enviado",
  ERROR: "Error",
};

const PUBLICO_OPCIONES: { v: PublicoManual; l: string; icon: typeof Users }[] = [
  { v: "CLIENTES", l: "Clientes", icon: Users },
  { v: "LEADS", l: "Leads", icon: UserPlus },
  { v: "LEADS_FORMULARIO", l: "Leads de un formulario", icon: ClipboardList },
];

const ESTADO_ESTILO: Record<Estado, string> = {
  BORRADOR: "bg-surface text-muted ring-1 ring-border",
  PROGRAMADA: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
  ENVIANDO: "bg-sky-50 text-sky-600 ring-1 ring-sky-200",
  ENVIADA: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
};
const ESTADO_LABEL: Record<Estado, string> = {
  BORRADOR: "Borrador",
  PROGRAMADA: "Programada",
  ENVIANDO: "Enviando…",
  ENVIADA: "Enviada",
};

const CAMPO_LABEL = "block text-sm font-medium text-foreground";
const CAMPO_INPUT = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export default function CampanasPage() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [conteoPublico, setConteoPublico] = useState<Record<"CLIENTES" | "LEADS", number> | null>(null);
  const [formularios, setFormularios] = useState<FormularioOpcion[]>([]);
  const [conteoFormulario, setConteoFormulario] = useState<number | null>(null);
  /** ¿WhatsApp Business (API oficial) conectado? null = todavía no se sabe. */
  const [whatsappConectado, setWhatsappConectado] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Campana | null>(null);
  const [publicoForm, setPublicoForm] = useState<PublicoManual>("CLIENTES");
  const [formularioIdForm, setFormularioIdForm] = useState("");
  const [plantillaMetaForm, setPlantillaMetaForm] = useState("");
  const [plantillaMetaIdiomaForm, setPlantillaMetaIdiomaForm] = useState("es");
  const [guardando, setGuardando] = useState(false);
  const [detalleAbiertoId, setDetalleAbiertoId] = useState<string | null>(null);
  const [destinatariosPorCampana, setDestinatariosPorCampana] = useState<Record<string, Destinatario[]>>({});
  const [cargandoDetalleId, setCargandoDetalleId] = useState<string | null>(null);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = () => api<Campana[]>("/campanas").then(setCampanas).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    Promise.all([
      api<{ telefono: string | null }[]>("/clientes"),
      api<{ telefono: string | null }[]>("/leads"),
    ])
      .then(([clientes, leads]) => {
        setConteoPublico({
          CLIENTES: clientes.filter((c) => c.telefono?.trim()).length,
          LEADS: leads.filter((l) => l.telefono?.trim()).length,
        });
      })
      .catch(() => {});
    api<FormularioOpcion[]>("/formularios-lead").then(setFormularios).catch(() => {});
    api<{ canal: string; estado: string }[]>("/integraciones")
      .then((r) => setWhatsappConectado(r.find((i) => i.canal === "WHATSAPP_API")?.estado === "CONECTADO"))
      .catch(() => {});
  }, []);

  // Conteo de leads con teléfono del formulario elegido — se recalcula cada vez que cambia
  // la selección (a diferencia de CLIENTES/LEADS, no se puede precalcular una sola vez).
  useEffect(() => {
    if (publicoForm !== "LEADS_FORMULARIO" || !formularioIdForm) return; // el render ya oculta el conteo en ese caso
    api<{ telefono: string | null }[]>(`/formularios-lead/${formularioIdForm}/leads`)
      .then((leads) => setConteoFormulario(leads.filter((l) => l.telefono?.trim()).length))
      .catch(() => setConteoFormulario(null));
  }, [publicoForm, formularioIdForm]);

  // Mientras haya alguna campaña "Enviando…", refresca cada 3s para ver el progreso avanzar
  // (y el detalle por destinatario, si está abierto justo el de esa campaña).
  useEffect(() => {
    const hayEnviando = campanas.some((c) => c.estado === "ENVIANDO");
    if (hayEnviando && !pollRef.current) {
      pollRef.current = setInterval(() => {
        cargar();
        if (detalleAbiertoId && campanas.find((c) => c.id === detalleAbiertoId)?.estado === "ENVIANDO") {
          cargarDetalle(detalleAbiertoId);
        }
      }, 3000);
    } else if (!hayEnviando && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (!hayEnviando && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanas]);

  function abrirNueva() {
    setEditando(null);
    setPublicoForm("CLIENTES");
    setFormularioIdForm("");
    setPlantillaMetaForm("");
    setPlantillaMetaIdiomaForm("es");
    setAbierto(true);
  }

  function abrirEdicion(c: Campana) {
    setEditando(c);
    setPublicoForm(c.publico === "LEADS" ? "LEADS" : c.publico === "LEADS_FORMULARIO" ? "LEADS_FORMULARIO" : "CLIENTES");
    setFormularioIdForm(c.formularioLeadId ?? "");
    setPlantillaMetaForm(c.plantillaMeta ?? "");
    setPlantillaMetaIdiomaForm(c.plantillaMetaIdioma ?? "es");
    setAbierto(true);
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    const body = {
      nombre: f.get("nombre"),
      canal: "WHATSAPP",
      publico: publicoForm,
      formularioLeadId: publicoForm === "LEADS_FORMULARIO" ? formularioIdForm || undefined : undefined,
      canalWhatsapp: "WHATSAPP_API",
      plantillaMeta: plantillaMetaForm || undefined,
      plantillaMetaIdioma: plantillaMetaIdiomaForm || "es",
    };
    try {
      if (editando) {
        await api(`/campanas/${editando.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/campanas", { method: "POST", body: JSON.stringify(body) });
      }
      setAbierto(false);
      setEditando(null);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    if (!(await confirmDialog("¿Eliminar esta campaña?"))) return;
    setError(null);
    try {
      await api(`/campanas/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function enviar(c: Campana) {
    const publicoLabel = c.publico === "CLIENTES" ? "tus clientes" : c.publico === "LEADS" ? "tus leads" : c.publico === "LEADS_FORMULARIO" ? "los leads de ese formulario" : "los créditos en mora";
    const cuenta = c.publico === "CLIENTES" || c.publico === "LEADS" ? conteoPublico?.[c.publico] : undefined;
    const mensajeConfirm = `Se va a enviar "${c.nombre}" por WhatsApp a ${cuenta !== undefined ? `${cuenta} de ` : ""}${publicoLabel} con teléfono registrado. No se puede deshacer.`;
    const ok = await confirmDialog(mensajeConfirm, { titulo: "¿Enviar campaña?", textoConfirmar: "Enviar ahora" });
    if (!ok) return;
    setError(null);
    setEnviandoId(c.id);
    try {
      await api(`/campanas/${c.id}/enviar`, { method: "POST" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviandoId(null);
    }
  }

  async function cargarDetalle(id: string) {
    setCargandoDetalleId(id);
    try {
      const r = await api<Destinatario[]>(`/campanas/${id}/destinatarios`);
      setDestinatariosPorCampana((prev) => ({ ...prev, [id]: r }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setCargandoDetalleId(null);
    }
  }

  function alternarDetalle(c: Campana) {
    if (detalleAbiertoId === c.id) { setDetalleAbiertoId(null); return; }
    setDetalleAbiertoId(c.id);
    cargarDetalle(c.id);
  }

  async function exportarCampana(c: Campana) {
    const lista = destinatariosPorCampana[c.id] ?? (await api<Destinatario[]>(`/campanas/${c.id}/destinatarios`).catch(() => []));
    exportarExcel(
      [{
        titulo: c.nombre,
        columnas: ["Nombre", "Teléfono", "Estado", "Enviado", "Error"],
        filas: lista.map((d) => [
          d.nombre, d.telefono, ESTADO_DEST_LABEL[d.estado],
          d.enviadoEn ? new Date(d.enviadoEn).toLocaleString("es-EC") : "",
          d.error ?? "",
        ]),
      }],
      `campana-${c.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    );
  }

  const enviadas = campanas.filter((c) => c.estado === "ENVIADA");
  const totalEnviados = campanas.reduce((s, c) => s + c.enviados, 0);
  const totalErrores = enviadas.reduce((s, c) => s + Math.max(0, c.totalDestinatarios - c.enviados), 0);
  const tasaExito = totalEnviados + totalErrores > 0 ? Math.round((totalEnviados / (totalEnviados + totalErrores)) * 100) : null;

  const kpis = [
    { icon: Megaphone, titulo: "Campañas", valor: campanas.length, color: "var(--color-primary)" },
    { icon: CheckCheck, titulo: "Mensajes enviados", valor: totalEnviados, color: "var(--color-status-good)" },
    { icon: AlertTriangle, titulo: "Errores de envío", valor: totalErrores, color: "var(--color-status-critical)" },
    { icon: Percent, titulo: "Tasa de éxito", valor: tasaExito !== null ? `${tasaExito}%` : "—", color: "var(--color-chart-3)" },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Campañas</h1>
          <p className="mt-1 text-sm text-muted">Envía una plantilla aprobada de WhatsApp Business a tus clientes o leads y sigue el resultado.</p>
        </div>
        <div className="flex items-center gap-3">
          {whatsappConectado === true && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              WhatsApp Business conectado
            </span>
          )}
          {whatsappConectado === false && (
            <Link
              href="/configuracion"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Conectar WhatsApp
            </Link>
          )}
          <button onClick={abrirNueva} className="btn-primary px-4 py-2 text-sm">+ Nueva campaña</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={k.color} />
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

      {abierto && (
        <form onSubmit={guardar} className="card mt-4 flex flex-col gap-3 p-5">
          <h2 className="font-display text-base font-semibold text-foreground">{editando ? "Editar campaña" : "Nueva campaña"}</h2>
          <label className="block">
            <span className={CAMPO_LABEL}>Nombre</span>
            <input name="nombre" required defaultValue={editando?.nombre} placeholder="Ej. Promoción de fin de mes" className={CAMPO_INPUT} />
          </label>
          <label className="block">
            <span className={CAMPO_LABEL}>Público</span>
            <select value={publicoForm} onChange={(e) => setPublicoForm(e.target.value as PublicoManual)} className={CAMPO_INPUT}>
              {PUBLICO_OPCIONES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
            {publicoForm === "LEADS_FORMULARIO" ? (
              <span className="mt-1 block text-xs text-muted">
                {formularioIdForm ? (conteoFormulario !== null ? `Se enviará a ${conteoFormulario} lead(s) con teléfono registrado.` : "Calculando destinatarios…") : "Elige de qué formulario vienen los leads."}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-muted">
                {conteoPublico ? `Se enviará a ${conteoPublico[publicoForm as "CLIENTES" | "LEADS"]} ${publicoForm === "CLIENTES" ? "cliente(s)" : "lead(s)"} con teléfono registrado.` : "Calculando destinatarios…"}
              </span>
            )}
          </label>

          {publicoForm === "LEADS_FORMULARIO" && (
            <label className="block">
              <span className={CAMPO_LABEL}>Formulario</span>
              <select value={formularioIdForm} onChange={(e) => setFormularioIdForm(e.target.value)} className={CAMPO_INPUT}>
                <option value="">Elige un formulario…</option>
                {formularios.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
              {formularios.length === 0 && (
                <span className="mt-1 block text-xs text-muted">Todavía no tienes formularios — créalos en <Link href="/formularios" className="text-primary hover:underline">Formularios</Link>.</span>
              )}
            </label>
          )}

          {whatsappConectado === false && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No tienes WhatsApp Business (API oficial) conectado — ve a <Link href="/configuracion" className="underline">Configuración</Link>.
            </p>
          )}

          <label className="block">
            <span className={CAMPO_LABEL}>Nombre de la plantilla</span>
            <input value={plantillaMetaForm} onChange={(e) => setPlantillaMetaForm(e.target.value)} required placeholder="Ej. bienvenida_feria" className={CAMPO_INPUT} />
          </label>
          <label className="block">
            <span className={CAMPO_LABEL}>Idioma de la plantilla</span>
            <input value={plantillaMetaIdiomaForm} onChange={(e) => setPlantillaMetaIdiomaForm(e.target.value)} placeholder="es" className={CAMPO_INPUT} />
          </label>
          <p className="text-xs text-muted">
            El nombre debe coincidir EXACTO con una plantilla ya aprobada en tu cuenta de Meta Business Manager — Meta exige plantilla pre-aprobada para escribirle primero a un contacto nuevo. Se envía con el primer nombre del lead como único parámetro.
          </p>

          <div className="flex gap-2">
            <button disabled={guardando} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar campaña"}
            </button>
            <button type="button" onClick={() => { setAbierto(false); setEditando(null); }} className="btn-outline px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 card overflow-hidden p-0">
        {campanas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Megaphone size={24} />
            </span>
            <div>
              <p className="font-display text-base font-semibold text-foreground">Manda tu primer mensaje masivo</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Elige una plantilla aprobada en Meta y si va para tus clientes o tus leads; se envía por WhatsApp Business a cada uno con su nombre.
              </p>
            </div>
            <button onClick={abrirNueva} className="btn-primary mt-1 px-5 py-2 text-sm">+ Nueva campaña</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Campaña</th>
                <th className="px-4 py-3 font-medium">Público</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Enviados</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campanas.map((c) => {
                const errores = c.estado === "ENVIADA" ? Math.max(0, c.totalDestinatarios - c.enviados) : 0;
                const tieneDestinatarios = c.estado === "ENVIANDO" || c.estado === "ENVIADA";
                const detalleAbierto = detalleAbiertoId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className={`hover:bg-surface/60 ${tieneDestinatarios ? "cursor-pointer" : ""}`} onClick={() => tieneDestinatarios && alternarDetalle(c)}>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          {tieneDestinatarios && <ChevronDown size={13} className={`shrink-0 text-muted transition-transform ${detalleAbierto ? "rotate-180" : ""}`} />}
                          {c.nombre}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <MessageCircle size={11} /> WhatsApp
                        </p>
                      </td>
                      <td className="px-4 py-3 text-foreground">{c.publico ? PUBLICO_LABEL[c.publico] : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_ESTILO[c.estado]}`}>
                          {ESTADO_LABEL[c.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {tieneDestinatarios ? (
                          <>
                            {c.enviados}/{c.totalDestinatarios}
                            {errores > 0 && <span className="ml-1.5 text-xs text-red-600 dark:text-red-400">({errores} error{errores > 1 ? "es" : ""})</span>}
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3">
                          {c.estado === "BORRADOR" && (
                            <>
                              <button
                                onClick={() => enviar(c)}
                                disabled={enviandoId === c.id}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                              >
                                <Send size={12} /> Enviar ahora
                              </button>
                              <button onClick={() => abrirEdicion(c)} title="Editar" className="text-muted hover:text-foreground">
                                <Pencil size={13} />
                              </button>
                            </>
                          )}
                          {tieneDestinatarios && (
                            <button onClick={() => exportarCampana(c)} title="Exportar" className="text-muted hover:text-foreground">
                              <Download size={13} />
                            </button>
                          )}
                          {c.estado !== "ENVIANDO" && (
                            <button onClick={() => eliminar(c.id)} title="Eliminar" className="text-muted hover:text-red-600">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {detalleAbierto && (
                      <tr>
                        <td colSpan={5} className="bg-surface/60 px-4 py-3">
                          {cargandoDetalleId === c.id && !destinatariosPorCampana[c.id] ? (
                            <p className="text-xs text-muted">Cargando destinatarios…</p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-border">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-card text-left uppercase tracking-wide text-muted">
                                  <tr>
                                    {["Nombre", "Teléfono", "Estado", "Detalle"].map((h) => (
                                      <th key={h} className="whitespace-nowrap px-3 py-1.5 font-medium">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card">
                                  {(destinatariosPorCampana[c.id] ?? []).map((d) => (
                                    <tr key={d.id}>
                                      <td className="whitespace-nowrap px-3 py-1.5 text-foreground">{d.nombre}</td>
                                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">{d.telefono}</td>
                                      <td className="whitespace-nowrap px-3 py-1.5">
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_DEST_ESTILO[d.estado]}`}>
                                          {ESTADO_DEST_LABEL[d.estado]}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-1.5 text-muted" title={d.error ?? undefined}>
                                        {d.error ? d.error.slice(0, 40) : d.enviadoEn ? new Date(d.enviadoEn).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
