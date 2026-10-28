"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { CategoriasCronopost } from "@/components/cronopost/categorias";
import { REDES, TONOS, DIAS, type Categoria, type CronopostConfig, type DiaSemana, type RedSocial, type TonoCopy } from "@/lib/cronopost";

const CAMPO = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-70";
const ETIQUETA = "mb-1 block text-xs font-medium text-foreground";
const AYUDA = "mt-1 block text-[11px] text-muted";

/** Configuración del cronopost: categorías, voz de la marca y reglas de planificación que usa la
 *  IA (propuestas de copy y plan semanal o mensual). Se guarda por organización. */
export function ConfiguracionIA({
  puedeEditar, categorias, onCategoriasCambio, onGuardada,
}: { puedeEditar: boolean; categorias: Categoria[]; onCategoriasCambio: () => void; onGuardada: (cfg: CronopostConfig) => void }) {
  const [cfg, setCfg] = useState<CronopostConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [iaConfigurada, setIaConfigurada] = useState<boolean | null>(null);

  useEffect(() => {
    api<CronopostConfig>("/cronopost/configuracion").then(setCfg).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"));
    api<{ origen: string | null }>("/ia/configuracion").then((e) => setIaConfigurada(e.origen !== null)).catch(() => {});
  }, []);

  if (!cfg) {
    return (
      <div className="card mt-4 flex items-center gap-2 p-6 text-sm text-muted">
        {error ?? <><Loader2 size={14} className="animate-spin" /> Cargando configuración…</>}
      </div>
    );
  }

  const set = <K extends keyof CronopostConfig>(k: K, v: CronopostConfig[K]) => {
    setCfg((c) => (c ? { ...c, [k]: v } : c));
    setGuardadoOk(false);
  };
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const espaciosPorSemana = cfg.dias.length * cfg.horarios.length;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setError(null);
    setGuardando(true);
    try {
      const datos: Partial<CronopostConfig> = { ...cfg };
      delete datos.guardada; // solo informativo, el API no lo acepta
      const r = await api<CronopostConfig>("/cronopost/configuracion", { method: "PUT", body: JSON.stringify(datos) });
      setCfg(r);
      setGuardadoOk(true);
      onGuardada(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {iaConfigurada === false && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Falta conectar la IA: un administrador debe cargar la API key de OpenAI en{" "}
          <Link href="/configuracion" className="font-medium underline underline-offset-2">Configuración → Inteligencia artificial</Link>.
        </p>
      )}

      <CategoriasCronopost categorias={categorias} puedeEditar={puedeEditar} onCambio={onCategoriasCambio} />

      <form onSubmit={guardar} className="space-y-4">
      {!cfg.guardada && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Todavía no hay configuración de la IA guardada: se usan estos valores iniciales. Complétala para que los copies suenen a la cooperativa.
        </p>
      )}

      <fieldset disabled={!puedeEditar} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Voz de la marca */}
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground"><Sparkles size={16} className="text-primary" /> Voz de la marca</h2>
          <label className="block"><span className={ETIQUETA}>Sobre la institución</span>
            <textarea rows={3} maxLength={1500} value={cfg.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)} className={CAMPO}
              placeholder="Ej. Cooperativa de ahorro y crédito con 20 agencias en el norte del Ecuador, cercana a emprendedores y familias." /></label>
          <label className="block"><span className={ETIQUETA}>Público objetivo</span>
            <textarea rows={2} maxLength={1000} value={cfg.publicoObjetivo ?? ""} onChange={(e) => set("publicoObjetivo", e.target.value)} className={CAMPO}
              placeholder="Ej. Emprendedores, agricultores y jóvenes de 18 a 45 años." /></label>
          <label className="block"><span className={ETIQUETA}>Productos y servicios a comunicar</span>
            <textarea rows={3} maxLength={1500} value={cfg.productos ?? ""} onChange={(e) => set("productos", e.target.value)} className={CAMPO}
              placeholder="Ej. Crédito de consumo, microcrédito, ahorro programado, depósitos a plazo fijo." />
            <span className={AYUDA}>La IA no inventa tasas ni montos: si quieres que los mencione, escríbelos aquí.</span></label>
          <label className="block"><span className={ETIQUETA}>Tono por defecto</span>
            <select value={cfg.tono} onChange={(e) => set("tono", e.target.value as TonoCopy)} className={CAMPO}>
              {TONOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select></label>
          <label className="block"><span className={ETIQUETA}>Qué debe evitar la IA</span>
            <textarea rows={2} maxLength={1500} value={cfg.restricciones ?? ""} onChange={(e) => set("restricciones", e.target.value)} className={CAMPO}
              placeholder="Ej. Hablar de la competencia, temas políticos, la palabra 'barato'." /></label>
          <label className="block"><span className={ETIQUETA}>Hashtags fijos</span>
            <input maxLength={300} value={cfg.hashtagsFijos ?? ""} onChange={(e) => set("hashtagsFijos", e.target.value)} className={CAMPO}
              placeholder="#SomosCooperativa #AhorroQueCrece" />
            <span className={AYUDA}>Se agregan siempre a lo que proponga la IA.</span></label>
        </section>

        {/* Planificación */}
        <section className="card space-y-4 p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Planificación</h2>

          <div>
            <span className={ETIQUETA}>Redes por defecto</span>
            <div className="flex flex-wrap gap-1.5">
              {REDES.map((r) => {
                const activa = cfg.redes.includes(r.v);
                return (
                  <button type="button" key={r.v} onClick={() => set("redes", alternar<RedSocial>(cfg.redes, r.v))}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${activa ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"}`}
                    style={activa ? { backgroundColor: r.color } : undefined}>
                    <r.icon size={12} /> {r.l}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
            <label className="block"><span className={ETIQUETA}>Publicaciones por semana</span>
              <input type="number" min={1} max={14} value={cfg.publicacionesPorSemana}
                onChange={(e) => set("publicacionesPorSemana", Math.max(1, Math.min(14, Number(e.target.value) || 1)))} className={CAMPO} /></label>
            <div>
              <span className={ETIQUETA}>Días para publicar</span>
              <div className="flex flex-wrap gap-1">
                {DIAS.map((d) => {
                  const activo = cfg.dias.includes(d.v);
                  return (
                    <button type="button" key={d.v} onClick={() => set("dias", alternar<DiaSemana>(cfg.dias, d.v))}
                      className={`h-9 w-11 rounded-lg text-xs font-medium ring-1 transition ${activo ? "bg-primary text-white ring-primary" : "bg-card text-muted ring-border hover:text-foreground"}`}>
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <span className={ETIQUETA}>Horarios</span>
            <div className="flex flex-wrap items-center gap-2">
              {cfg.horarios.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <input type="time" value={h} onChange={(e) => set("horarios", cfg.horarios.map((x, j) => (j === i ? e.target.value : x)))}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary" />
                  {puedeEditar && cfg.horarios.length > 1 && (
                    <button type="button" onClick={() => set("horarios", cfg.horarios.filter((_, j) => j !== i))} aria-label="Quitar horario" className="text-muted hover:text-red-600"><X size={14} /></button>
                  )}
                </span>
              ))}
              {puedeEditar && cfg.horarios.length < 4 && (
                <button type="button" onClick={() => set("horarios", [...cfg.horarios, "18:00"])}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft"><Plus size={13} /> Horario</button>
              )}
            </div>
          </div>

          <p className={`rounded-lg px-3 py-2 text-xs ${cfg.publicacionesPorSemana > espaciosPorSemana ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-surface text-muted"}`}>
            {cfg.publicacionesPorSemana > espaciosPorSemana
              ? `Con ${cfg.dias.length} día(s) y ${cfg.horarios.length} horario(s) solo hay ${espaciosPorSemana} espacio(s) por semana: la IA planificará ${espaciosPorSemana}. Agrega días u horarios para llegar a ${cfg.publicacionesPorSemana}.`
              : `La IA planificará ${cfg.publicacionesPorSemana} publicación(es) por semana, repartidas entre ${cfg.dias.length} día(s) y ${cfg.horarios.length} horario(s).`}
          </p>
        </section>
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
      {puedeEditar && (
        <div className="flex items-center gap-3">
          <button disabled={guardando} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
          {guardadoOk && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={15} /> Guardada</span>}
        </div>
      )}
      </form>
    </div>
  );
}
