"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Inbox, CheckCircle2, XCircle, Clock, MapPin, Phone, Mail, X, Send, Building2, MailCheck, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Kpi } from "@/components/crm-widgets";
import { confirmDialog } from "@/components/confirm-dialog";
import { api, leerSesion, type Sesion } from "@/lib/api";
import {
  CRITERIOS_RIESGO, ESTADO_RIESGO, NIVEL_RIESGO, money,
  type Analisis, type EstadoRiesgo, type NivelRiesgo, type LeadMini,
} from "@/lib/riesgos";

type Fila = LeadMini & { analisisRiesgo?: Analisis | null };
type AnalisisConLead = Analisis & { lead: LeadMini };

const ROLES_ANALISTA = ["OWNER", "ADMIN", "RIESGOS"];

export default function RiesgosPage() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  useEffect(() => setSesion(leerSesion()), []);
  const esAnalista = !!sesion && ROLES_ANALISTA.includes(sesion.rol);

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><ShieldCheck size={20} /></span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Riesgos</h1>
          <p className="text-sm text-muted">
            {esAnalista
              ? "Analiza cada prospecto calificado y, al aprobarlo, pasa al jefe de su agencia."
              : "Prospectos aprobados por el equipo de riesgos, listos para tu agencia."}
          </p>
        </div>
      </div>
      {sesion && (esAnalista ? <VistaAnalista /> : <VistaJefeAgencia />)}
    </AppShell>
  );
}

interface PendientesEnvio {
  umbral: number;
  smtp: boolean;
  agencias: { sucursalId: string; nombre: string; pendientes: number; jefes: number }[];
}

/** Equipo de riesgos / administración: cola por analizar + histórico, y la ficha de evaluación. */
function VistaAnalista() {
  const [resumen, setResumen] = useState<{ enCola: number; aprobados: number; rechazados: number; observados: number; pendientesEnvio: number } | null>(null);
  const [cola, setCola] = useState<Fila[]>([]);
  const [analizados, setAnalizados] = useState<AnalisisConLead[]>([]);
  const [envio, setEnvio] = useState<PendientesEnvio | null>(null);
  const [tab, setTab] = useState<"cola" | "historial">("cola");
  const [leadActivo, setLeadActivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    api<typeof resumen>("/riesgos/resumen").then(setResumen).catch(() => {});
    api<Fila[]>("/riesgos/cola").then(setCola).catch((e) => setError(e.message));
    api<AnalisisConLead[]>("/riesgos").then(setAnalizados).catch(() => {});
    api<PendientesEnvio>("/riesgos/pendientes-envio").then(setEnvio).catch(() => {});
  };
  useEffect(cargar, []);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi icon={Inbox} titulo="Por analizar" valor={resumen?.enCola ?? 0} tendencia={null} color="var(--color-chart-1)" />
        <Kpi icon={CheckCircle2} titulo="Aprobados" valor={resumen?.aprobados ?? 0} tendencia={null} color="var(--color-status-good)" />
        <Kpi icon={XCircle} titulo="Rechazados" valor={resumen?.rechazados ?? 0} tendencia={null} color="var(--color-status-critical)" />
        <Kpi icon={Clock} titulo="Observados" valor={resumen?.observados ?? 0} tendencia={null} color="var(--color-chart-5)" />
      </div>

      <PanelEnvio envio={envio} onEnviado={cargar} />

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

      <div className="mt-6 flex gap-1.5">
        {([["cola", `Por analizar (${cola.length})`], ["historial", `Analizados (${analizados.length})`]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${tab === v ? "bg-primary text-white ring-primary" : "bg-card text-muted ring-border hover:text-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>{(tab === "cola" ? ["Prospecto", "Ciudad / agencia", "Contacto", ""] : ["Prospecto", "Agencia", "Nivel", "Estado", ""]).map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">{c}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tab === "cola" ? (
              cola.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted"><Inbox size={22} className="mx-auto mb-2 text-muted/60" />No hay prospectos en cola. Aparecen aquí cuando un asesor los marca “Calificado”.</td></tr>
              ) : cola.map((l) => (
                <tr key={l.id} className="hover:bg-surface/60">
                  <td className="px-4 py-3"><p className="font-medium text-foreground">{l.nombre}</p>{l.analisisRiesgo && <EstadoChip estado={l.analisisRiesgo.estado} />}</td>
                  <td className="px-4 py-3"><CeldaAgencia lead={l} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{l.telefono ?? l.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setLeadActivo(l.id)} className="btn-primary px-3 py-1.5 text-xs">Analizar</button></td>
                </tr>
              ))
            ) : (
              analizados.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Todavía no hay análisis.</td></tr>
              ) : analizados.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setLeadActivo(a.lead.id)}>
                  <td className="px-4 py-3 font-medium text-foreground">{a.lead.nombre}</td>
                  <td className="px-4 py-3 text-xs text-muted">{a.lead.sucursal?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">{a.nivel ? <span className="text-xs font-medium" style={{ color: NIVEL_RIESGO[a.nivel].hex }}>{NIVEL_RIESGO[a.nivel].label}</span> : "—"}</td>
                  <td className="px-4 py-3"><EstadoChip estado={a.estado} /></td>
                  <td className="px-4 py-3 text-right text-xs text-primary">Ver / editar</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {leadActivo && <FichaAnalisis leadId={leadActivo} onCerrar={() => setLeadActivo(null)} onGuardado={() => { setLeadActivo(null); cargar(); }} />}
    </>
  );
}

/** Jefe de agencia: solo ve los aprobados de su agencia (su bandeja de trabajo). */
function VistaJefeAgencia() {
  const [filas, setFilas] = useState<AnalisisConLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  useEffect(() => { api<AnalisisConLead[]>("/riesgos?aprobados=1").then(setFilas).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Kpi icon={CheckCircle2} titulo="Aprobados para tu agencia" valor={filas.length} tendencia={null} color="var(--color-status-good)" />
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filas.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-border py-12 text-center text-muted">
            <ShieldCheck size={24} className="mx-auto mb-2 text-muted/60" />
            Aún no hay prospectos aprobados para tu agencia.
          </div>
        ) : filas.map((a) => (
          <button key={a.id} onClick={() => setVer(a.lead.id)} className="card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40">
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-foreground">{a.lead.nombre}</p>
              {a.nivel && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${NIVEL_RIESGO[a.nivel].hex}1f`, color: NIVEL_RIESGO[a.nivel].hex }}>{NIVEL_RIESGO[a.nivel].label}</span>}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><MapPin size={12} /> {a.lead.ciudad ?? "—"} · {a.lead.sucursal?.nombre ?? "—"}</p>
            {a.montoAprobado && <p className="mt-2 text-sm text-foreground">Monto aprobado: <span className="font-semibold text-primary">{money(a.montoAprobado)}</span></p>}
            {a.lead.telefono && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Phone size={12} /> {a.lead.telefono}</p>}
          </button>
        ))}
      </div>
      {ver && <FichaAnalisis leadId={ver} soloLectura onCerrar={() => setVer(null)} onGuardado={() => setVer(null)} />}
    </>
  );
}

/** Envío de lotes a los jefes de agencia: muestra cuántos aprobados esperan por agencia, deja
 *  enviarlos ya (sin esperar al umbral) y configurar cada cuántos se envían solos. */
function PanelEnvio({ envio, onEnviado }: { envio: PendientesEnvio | null; onEnviado: () => void }) {
  const [enviando, setEnviando] = useState<string | null>(null); // sucursalId o "todas"
  const [umbral, setUmbral] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { if (envio) setUmbral(String(envio.umbral)); }, [envio]);
  if (!envio) return null;

  const total = envio.agencias.reduce((s, a) => s + a.pendientes, 0);

  async function enviar(sucursalId?: string) {
    const quienes = sucursalId ? envio!.agencias.find((a) => a.sucursalId === sucursalId)?.nombre : "todas las agencias";
    if (!(await confirmDialog(`¿Enviar por correo los prospectos aprobados pendientes a ${quienes}? Esto los marca como enviados.`))) return;
    setAviso(null);
    setEnviando(sucursalId ?? "todas");
    try {
      const r = await api<{ enviados: number; agencias: number; sinJefe: string[]; smtp: boolean }>("/riesgos/enviar", { method: "POST", body: JSON.stringify(sucursalId ? { sucursalId } : {}) });
      const partes = [`${r.enviados} prospecto(s) enviados a ${r.agencias} agencia(s).`];
      if (!r.smtp) partes.push("SMTP no está configurado: los correos salieron al registro del servidor, no al buzón real.");
      if (r.sinJefe?.length) partes.push(`Sin jefe de agencia asignado (no se envió): ${r.sinJefe.join(", ")}.`);
      setAviso(partes.join(" "));
      onEnviado();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setEnviando(null);
    }
  }

  async function guardarUmbral() {
    const n = Number(umbral);
    if (!Number.isInteger(n) || n < 1 || n > 100) { setAviso("El umbral debe ser un número entre 1 y 100."); return; }
    try {
      await api("/organizacion", { method: "PATCH", body: JSON.stringify({ umbralLoteRiesgo: n }) });
      setAviso(`Listo: ahora cada ${n} aprobados por agencia se envían automáticamente.`);
      onEnviado();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo guardar el umbral");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <MailCheck size={17} className="text-primary" /> Envío a los jefes de agencia
          </h2>
          <p className="mt-1 text-sm text-muted">
            Los aprobados se envían por correo en lote: solos cuando una agencia junta <b>{envio.umbral}</b>, o cuando los mandas tú.
          </p>
        </div>
        {total > 0 && (
          <button onClick={() => enviar()} disabled={!!enviando} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            <Send size={14} /> {enviando === "todas" ? "Enviando…" : `Enviar todo (${total})`}
          </button>
        )}
      </div>

      {!envio.smtp && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> El correo saliente (SMTP) no está configurado. Los lotes se registrarán en el servidor pero no llegarán al buzón de los jefes hasta configurarlo.
        </p>
      )}
      {aviso && <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary">{aviso}</p>}

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted">No hay prospectos aprobados pendientes de enviar.</p>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-lg ring-1 ring-border">
          {envio.agencias.map((a) => {
            const listo = a.pendientes >= envio.umbral;
            return (
              <div key={a.sucursalId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><Building2 size={13} className="text-primary" /> {a.nombre}</p>
                  <p className="text-[11px] text-muted">
                    {a.pendientes} pendiente(s) · {a.jefes > 0 ? `${a.jefes} jefe(s) recibirán el correo` : "sin jefe de agencia asignado"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${listo ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-surface text-muted ring-1 ring-border"}`}>
                    {a.pendientes}/{envio.umbral}
                  </span>
                  <button
                    onClick={() => enviar(a.sucursalId)}
                    disabled={!!enviando || a.jefes === 0}
                    title={a.jefes === 0 ? "Asigna un jefe (Supervisor) a esta agencia en Equipo" : "Enviar ahora, sin esperar al umbral"}
                    className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {enviando === a.sucursalId ? "Enviando…" : "Enviar ahora"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Umbral configurable */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="text-xs text-muted">Enviar automáticamente cada</span>
        <input type="number" min={1} max={100} value={umbral} onChange={(e) => setUmbral(e.target.value)}
          className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary" />
        <span className="text-xs text-muted">aprobados por agencia</span>
        <button onClick={guardarUmbral} className="btn-outline px-3 py-1 text-xs">Guardar</button>
      </div>
    </section>
  );
}

function EstadoChip({ estado }: { estado: EstadoRiesgo }) {
  const e = ESTADO_RIESGO[estado];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${e.clase}`}>{e.label}</span>;
}

function CeldaAgencia({ lead }: { lead: LeadMini }) {
  if (lead.sucursal) return <span className="inline-flex items-center gap-1 text-xs text-foreground"><Building2 size={12} className="text-primary" /> {lead.sucursal.nombre}</span>;
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400">{lead.ciudad ? `${lead.ciudad} · sin agencia` : "Sin ciudad"}</span>;
}

/** Ficha de evaluación: datos del prospecto + checklist + decisión. */
function FichaAnalisis({ leadId, soloLectura = false, onCerrar, onGuardado }: { leadId: string; soloLectura?: boolean; onCerrar: () => void; onGuardado: () => void }) {
  const [lead, setLead] = useState<(LeadMini & { empresa?: string | null; fuente?: string | null; notas?: string | null; analisisRiesgo?: Analisis | null }) | null>(null);
  const [form, setForm] = useState({
    estado: "EN_ANALISIS" as EstadoRiesgo, nivel: "" as NivelRiesgo | "",
    puntaje: "", montoSolicitado: "", montoAprobado: "", ingresos: "", egresos: "", observaciones: "",
    criterios: {} as Record<string, boolean>,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<typeof lead>(`/riesgos/${leadId}`).then((l) => {
      setLead(l);
      const a = l?.analisisRiesgo;
      if (a) setForm({
        estado: a.estado, nivel: a.nivel ?? "", puntaje: a.puntaje?.toString() ?? "",
        montoSolicitado: a.montoSolicitado ?? "", montoAprobado: a.montoAprobado ?? "",
        ingresos: a.ingresos ?? "", egresos: a.egresos ?? "", observaciones: a.observaciones ?? "",
        criterios: a.criterios ?? {},
      });
    }).catch((e) => setError(e.message));
  }, [leadId]);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const cumplidos = useMemo(() => CRITERIOS_RIESGO.filter((c) => form.criterios[c.clave]).length, [form.criterios]);

  async function guardar(estado: EstadoRiesgo) {
    setError(null);
    setGuardando(true);
    try {
      await api(`/riesgos/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({
          estado,
          nivel: form.nivel || null,
          puntaje: num(form.puntaje),
          montoSolicitado: num(form.montoSolicitado),
          montoAprobado: num(form.montoAprobado),
          ingresos: num(form.ingresos),
          egresos: num(form.egresos),
          criterios: form.criterios,
          observaciones: form.observaciones || null,
        }),
      });
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div role="presentation" onClick={onCerrar} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card my-8 w-full max-w-2xl p-0">
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">{lead?.nombre ?? "Cargando…"}</h2>
              {lead?.analisisRiesgo && <EstadoChip estado={lead.analisisRiesgo.estado} />}
            </div>
            {lead && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {lead.telefono && <span className="inline-flex items-center gap-1"><Phone size={11} /> {lead.telefono}</span>}
                {lead.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {lead.email}</span>}
                <span className="inline-flex items-center gap-1"><MapPin size={11} /> {lead.ciudad ?? "Sin ciudad"} · {lead.sucursal?.nombre ?? "Sin agencia"}</span>
              </div>
            )}
          </div>
          <button onClick={onCerrar} className="shrink-0 text-muted hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

          <fieldset disabled={soloLectura || guardando} className="space-y-5">
            {/* Datos económicos */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Datos económicos</h3>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CampoNum label="Monto solicitado" valor={form.montoSolicitado} onChange={(v) => setForm({ ...form, montoSolicitado: v })} />
                <CampoNum label="Ingresos" valor={form.ingresos} onChange={(v) => setForm({ ...form, ingresos: v })} />
                <CampoNum label="Egresos" valor={form.egresos} onChange={(v) => setForm({ ...form, egresos: v })} />
                <CampoNum label="Puntaje (0-100)" valor={form.puntaje} onChange={(v) => setForm({ ...form, puntaje: v })} max={100} />
              </div>
            </div>

            {/* Checklist de criterios */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Criterios revisados</h3>
                <span className="text-xs font-medium text-muted">{cumplidos}/{CRITERIOS_RIESGO.length}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {CRITERIOS_RIESGO.map((c) => (
                  <label key={c.clave} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.criterios[c.clave]}
                      onChange={(e) => setForm({ ...form, criterios: { ...form.criterios, [c.clave]: e.target.checked } })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary"
                    />
                    <span className="text-foreground">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nivel de riesgo */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Nivel de riesgo</h3>
              <div className="mt-2 flex gap-2">
                {(Object.keys(NIVEL_RIESGO) as NivelRiesgo[]).map((nv) => {
                  const activo = form.nivel === nv;
                  return (
                    <button key={nv} type="button" onClick={() => setForm({ ...form, nivel: activo ? "" : nv })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${activo ? "text-white" : "border-border bg-card text-muted hover:border-primary/40"}`}
                      style={activo ? { backgroundColor: NIVEL_RIESGO[nv].hex, borderColor: NIVEL_RIESGO[nv].hex } : undefined}>
                      {NIVEL_RIESGO[nv].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Monto aprobado + observaciones */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CampoNum label="Monto a aprobar" valor={form.montoAprobado} onChange={(v) => setForm({ ...form, montoAprobado: v })} className="sm:col-span-1" />
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-foreground">Observaciones</span>
                <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={2}
                  placeholder="Motivo de la decisión, condiciones, lo que falta…"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </label>
            </div>
          </fieldset>
        </div>

        {/* Decisiones */}
        {!soloLectura && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
            <button onClick={() => guardar("APROBADO")} disabled={guardando} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              <Send size={14} /> Aprobar y enviar a la agencia
            </button>
            <button onClick={() => guardar("OBSERVADO")} disabled={guardando} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              Observar
            </button>
            <button onClick={() => guardar("RECHAZADO")} disabled={guardando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              Rechazar
            </button>
            <button onClick={() => guardar("EN_ANALISIS")} disabled={guardando} className="btn-outline ml-auto px-3 py-2 text-sm">Guardar borrador</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CampoNum({ label, valor, onChange, max, className = "" }: { label: string; valor: string; onChange: (v: string) => void; max?: number; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <input type="number" min={0} max={max} step="0.01" value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
    </label>
  );
}
