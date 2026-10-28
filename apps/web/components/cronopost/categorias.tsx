"use client";

import { useState } from "react";
import { Tags, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { confirmDialog } from "@/components/confirm-dialog";
import { COLORES_CATEGORIA, type Categoria } from "@/lib/cronopost";

const CAMPO = "w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-70";

/** Lista configurable de categorías del cronopost (Crédito, Inversiones, Seguridad…). Cada cambio
 *  se guarda al momento (al salir del campo), sin botón de guardar aparte. */
export function CategoriasCronopost({
  categorias, puedeEditar, onCambio,
}: { categorias: Categoria[]; puedeEditar: boolean; onCambio: () => void }) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES_CATEGORIA[categorias.length % COLORES_CATEGORIA.length]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Los campos son "no controlados" (se guardan al salir): cambiar la key los vuelve a montar con
  // el valor del servidor, así un cambio rechazado no queda escrito en pantalla.
  const [version, setVersion] = useState(0);

  async function llamar(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onCambio();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setVersion((v) => v + 1);
      return false;
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setGuardando(true);
    const ok = await llamar(() => api("/cronopost/categorias", { method: "POST", body: JSON.stringify({ nombre: nombre.trim(), color }) }));
    setGuardando(false);
    if (ok) {
      setNombre("");
      setColor(COLORES_CATEGORIA[(categorias.length + 1) % COLORES_CATEGORIA.length]);
    }
  }

  const actualizar = (c: Categoria, cambios: Partial<Pick<Categoria, "nombre" | "color" | "descripcion" | "orden">>) =>
    llamar(() => api(`/cronopost/categorias/${c.id}`, { method: "PATCH", body: JSON.stringify(cambios) }));

  /** Intercambia el orden con la vecina (arriba o abajo). */
  async function mover(i: number, delta: -1 | 1) {
    const a = categorias[i];
    const b = categorias[i + delta];
    if (!a || !b) return;
    await llamar(async () => {
      await api(`/cronopost/categorias/${a.id}`, { method: "PATCH", body: JSON.stringify({ orden: i + delta + 1 }) });
      await api(`/cronopost/categorias/${b.id}`, { method: "PATCH", body: JSON.stringify({ orden: i + 1 }) });
    });
  }

  async function eliminar(c: Categoria) {
    const n = c._count?.publicaciones ?? 0;
    const detalle = n ? ` Sus ${n} publicación(es) no se borran: quedan sin categoría.` : "";
    if (!(await confirmDialog(`¿Eliminar la categoría "${c.nombre}"?${detalle}`, { titulo: "¿Eliminar categoría?", textoConfirmar: "Eliminar" }))) return;
    await llamar(() => api(`/cronopost/categorias/${c.id}`, { method: "DELETE" }));
  }

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground"><Tags size={16} className="text-primary" /> Categorías</h2>
      <p className="mt-0.5 text-sm text-muted">
        Clasifican cada publicación (ej. Crédito, Inversiones, Seguridad). La descripción le explica a la IA qué cubre cada una.
      </p>

      <div className="mt-4 space-y-2">
        {categorias.length === 0 && <p className="text-sm text-muted">Todavía no hay categorías.</p>}
        {categorias.map((c, i) => (
          <div key={`${c.id}-${c.nombre}-${c.color}-${c.descripcion}-${version}`} className="grid grid-cols-[auto_minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border p-2">
            <input type="color" defaultValue={c.color} disabled={!puedeEditar} aria-label={`Color de ${c.nombre}`}
              onBlur={(e) => e.target.value !== c.color && actualizar(c, { color: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed" />
            <input defaultValue={c.nombre} maxLength={40} disabled={!puedeEditar} aria-label="Nombre"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nombre) actualizar(c, { nombre: v }); else e.target.value = c.nombre; }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className={`${CAMPO} font-medium`} />
            <input defaultValue={c.descripcion ?? ""} maxLength={200} disabled={!puedeEditar} aria-label="Descripción para la IA"
              placeholder="Qué cubre (orienta a la IA)"
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (c.descripcion ?? "")) actualizar(c, { descripcion: v || null }); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className={CAMPO} />
            <div className="flex items-center gap-0.5">
              <span className="mr-1 hidden whitespace-nowrap text-[11px] text-muted sm:inline">{c._count?.publicaciones ?? 0} pub.</span>
              {puedeEditar && (
                <>
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded p-1 text-muted hover:text-foreground disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === categorias.length - 1} aria-label="Bajar" className="rounded p-1 text-muted hover:text-foreground disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => eliminar(c)} aria-label={`Eliminar ${c.nombre}`} className="rounded p-1 text-muted hover:text-red-600"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {puedeEditar && categorias.length < 20 && (
        <form onSubmit={crear} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color de la nueva categoría"
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5" />
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} placeholder="Nueva categoría, ej. Tarjetas" className={CAMPO} />
          <button disabled={guardando || !nombre.trim()} className="btn-outline inline-flex shrink-0 items-center gap-1 px-3 py-2 text-xs disabled:opacity-50">
            <Plus size={13} /> Agregar
          </button>
        </form>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
    </section>
  );
}
