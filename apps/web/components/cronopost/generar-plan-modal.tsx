"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { DIAS, redInfo, tipoInfo, type Categoria, type CronopostConfig, type PropuestaPlan } from "@/lib/cronopost";

const CAMPO = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const ETIQUETA = "mb-1 block text-xs font-medium text-foreground";

const dosDigitos = (n: number) => String(n).padStart(2, "0");
const fechaInput = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
const fechaCorta = (d: Date) => d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });

function lunesDe(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  return new Date(y, m - 1, d - ((base.getDay() + 6) % 7));
}

interface RespuestaPlan { propuestas: PropuestaPlan[]; aviso: string | null }

/** Le pide a la IA el cronopost completo de una semana o un mes según la configuración, muestra
 *  las propuestas y guarda solo las que el equipo elija (quedan como "Idea"). */
export function GenerarPlanModal({
  mes, config, categorias, miembros, onClose, onGuardado, onIrAConfiguracion,
}: {
  mes: Date;
  config: CronopostConfig | null;
  categorias: Categoria[];
  miembros: { id: string; user: { nombre: string } }[];
  onClose: () => void;
  onGuardado: (creadas: number) => void;
  onIrAConfiguracion: () => void;
}) {
  const hoy = new Date();
  const mismoMes = mes.getFullYear() === hoy.getFullYear() && mes.getMonth() === hoy.getMonth();
  const [periodo, setPeriodo] = useState<"SEMANA" | "MES">("SEMANA");
  const [diaSemana, setDiaSemana] = useState(fechaInput(mismoMes ? hoy : new Date(mes.getFullYear(), mes.getMonth(), 1)));
  const [mesInput, setMesInput] = useState(`${mes.getFullYear()}-${dosDigitos(mes.getMonth() + 1)}`);
  const [indicaciones, setIndicaciones] = useState("");
  /** Categorías a repartir en el plan (por defecto, todas). */
  const [catElegidas, setCatElegidas] = useState<Set<string>>(() => new Set(categorias.map((c) => c.id)));
  const [generando, setGenerando] = useState(false);
  const [propuestas, setPropuestas] = useState<PropuestaPlan[] | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [responsableId, setResponsableId] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lunes = lunesDe(diaSemana);
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);

  async function generar() {
    setError(null);
    setAviso(null);
    setGenerando(true);
    setPropuestas(null);
    try {
      const r = await api<RespuestaPlan>("/cronopost/generar-plan", {
        method: "POST",
        body: JSON.stringify({
          periodo,
          inicio: periodo === "SEMANA" ? diaSemana : `${mesInput}-01`,
          indicaciones: indicaciones.trim() || undefined,
          // Todas elegidas = no se manda el filtro (el servidor usa todas, incluidas las que se creen después).
          categoriaIds: catElegidas.size === categorias.length ? undefined : [...catElegidas],
        }),
      });
      setPropuestas(r.propuestas);
      setElegidas(new Set(r.propuestas.map((_, i) => i)));
      setAviso(r.aviso);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el plan");
    } finally {
      setGenerando(false);
    }
  }

  async function guardar() {
    if (!propuestas) return;
    setError(null);
    setGuardando(true);
    try {
      const publicaciones = propuestas.filter((_, i) => elegidas.has(i)).map((p) => ({
        fecha: p.fecha, redes: p.redes, tipo: p.tipo, tema: p.tema, copy: p.copy, hashtags: p.hashtags,
        estado: "IDEA", responsableId: responsableId || null, categoriaId: p.categoriaId,
      }));
      const r = await api<{ creadas: number }>("/cronopost/lote", { method: "POST", body: JSON.stringify({ publicaciones }) });
      onGuardado(r.creadas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  function alternar(i: number) {
    setElegidas((prev) => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  }

  const resumenConfig = config && [
    `${config.publicacionesPorSemana} por semana`,
    DIAS.filter((d) => config.dias.includes(d.v)).map((d) => d.l).join(", "),
    config.horarios.join(" y "),
    config.redes.map((r) => redInfo(r).l).join(", "),
  ].join(" · ");

  return (
    <div role="presentation" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground"><Sparkles size={16} className="text-primary" /> Generar cronopost con IA</h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <div>
              <span className={ETIQUETA}>Período</span>
              <div className="flex rounded-lg border border-border p-0.5">
                {(["SEMANA", "MES"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPeriodo(p)}
                    className={`h-8 rounded-md px-4 text-xs font-medium transition ${periodo === p ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}>
                    {p === "SEMANA" ? "Semana" : "Mes"}
                  </button>
                ))}
              </div>
            </div>
            {periodo === "SEMANA" ? (
              <label className="block"><span className={ETIQUETA}>Semana del {fechaCorta(lunes)} al {fechaCorta(domingo)}</span>
                <input type="date" value={diaSemana} onChange={(e) => e.target.value && setDiaSemana(e.target.value)} className={CAMPO} /></label>
            ) : (
              <label className="block"><span className={ETIQUETA}>Mes</span>
                <input type="month" value={mesInput} onChange={(e) => e.target.value && setMesInput(e.target.value)} className={CAMPO} /></label>
            )}
          </div>

          <label className="block"><span className={ETIQUETA}>Indicaciones para este período (opcional)</span>
            <textarea rows={2} maxLength={500} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} className={CAMPO}
              placeholder="Ej. Esta semana es el aniversario de la cooperativa; promocionar el ahorro navideño." /></label>

          {categorias.length > 0 && (
            <div>
              <span className={ETIQUETA}>Categorías a incluir</span>
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((c) => {
                  const activa = catElegidas.has(c.id);
                  return (
                    <button type="button" key={c.id}
                      onClick={() => setCatElegidas((prev) => {
                        const s2 = new Set(prev);
                        if (s2.has(c.id)) { if (s2.size > 1) s2.delete(c.id); } else s2.add(c.id);
                        return s2;
                      })}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${activa ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"}`}
                      style={activa ? { backgroundColor: c.color } : undefined}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activa ? "white" : c.color }} /> {c.nombre}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1 block text-[11px] text-muted">La IA reparte las publicaciones entre las categorías marcadas.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
            <span>{resumenConfig ?? "Cargando configuración…"}</span>
            <button type="button" onClick={onIrAConfiguracion} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <Settings2 size={12} /> Cambiar configuración
            </button>
          </div>
          <p className="text-[11px] text-muted">A la IA solo viajan la configuración de la marca y estas indicaciones: no escribas datos de socios ni prospectos. Las propuestas se guardan como &quot;Idea&quot; para que el equipo las revise.</p>

          <button type="button" onClick={generar} disabled={generando} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
            {generando ? <><Loader2 size={14} className="animate-spin" /> Generando… (puede tardar un minuto)</> : <><Sparkles size={14} /> {propuestas ? "Volver a generar" : "Generar propuesta"}</>}
          </button>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
          {aviso && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{aviso}</p>}

          {propuestas && propuestas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{elegidas.size} de {propuestas.length} seleccionadas</span>
                <button type="button" onClick={() => setElegidas(elegidas.size === propuestas.length ? new Set() : new Set(propuestas.map((_, i) => i)))}
                  className="font-medium text-primary hover:underline">
                  {elegidas.size === propuestas.length ? "Quitar todas" : "Elegir todas"}
                </button>
              </div>
              {propuestas.map((p, i) => {
                const f = new Date(p.fecha);
                const T = tipoInfo(p.tipo);
                return (
                  <label key={i} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${elegidas.has(i) ? "border-primary/40 bg-primary-soft/30" : "border-border opacity-70"}`}>
                    <input type="checkbox" checked={elegidas.has(i)} onChange={() => alternar(i)} className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className="font-medium text-foreground">
                          {f.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" })} · {f.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex gap-1">{p.redes.map((r) => { const R = redInfo(r); return <R.icon key={r} size={12} style={{ color: R.color }} aria-label={R.l} />; })}</span>
                        <span className="inline-flex items-center gap-1"><T.icon size={12} /> {T.l}</span>
                        {p.categoria && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                            style={{ color: p.categoria.color, backgroundColor: `color-mix(in srgb, ${p.categoria.color} 12%, transparent)` }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.categoria.color }} /> {p.categoria.nombre}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">{p.tema}</p>
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{p.copy}</p>
                      <p className="mt-1 text-xs text-primary">{p.hashtags}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {propuestas && propuestas.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
            <label className="flex items-center gap-2 text-xs text-muted">Responsable
              <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground">
                <option value="">Sin asignar</option>
                {miembros.map((m) => <option key={m.id} value={m.id}>{m.user.nombre}</option>)}
              </select>
            </label>
            <button onClick={guardar} disabled={guardando || elegidas.size === 0} className="btn-primary ml-auto px-5 py-2 text-sm disabled:opacity-50">
              {guardando ? "Guardando…" : `Agregar ${elegidas.size} al cronopost`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
