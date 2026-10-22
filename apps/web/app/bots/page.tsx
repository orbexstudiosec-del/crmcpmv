"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Pencil, Trash2, Power, Sparkles, Layers, ArrowLeft, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";

interface BotFlow {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  canal: string | null;
  updatedAt: string;
}

interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  etiqueta: string;
  nombreSugerido: string;
  descripcionSugerida: string;
  nodos: number;
  conexiones: number;
}

const CANAL_LABEL: Record<string, string> = {
  WHATSAPP_API: "WhatsApp Business",
  MESSENGER: "Messenger",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

type PasoModal = "cerrado" | "elegir" | "formulario";

export default function BotsPage() {
  const [bots, setBots] = useState<BotFlow[] | null>(null);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<PasoModal>("cerrado");
  const [plantillaElegida, setPlantillaElegida] = useState<Plantilla | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api<BotFlow[]>("/bots").then(setBots).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    api<Plantilla[]>("/bots/templates").then(setPlantillas).catch(() => {});
  }, []);

  function abrirPicker() {
    setError(null);
    setPaso("elegir");
  }

  function elegir(p: Plantilla | null) {
    setPlantillaElegida(p);
    setNombre(p?.nombreSugerido ?? "");
    setDescripcion(p?.descripcionSugerida ?? "");
    setPaso("formulario");
  }

  function cerrarModal() {
    setPaso("cerrado");
    setPlantillaElegida(null);
  }

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    try {
      const nuevo = await api<BotFlow>("/bots", {
        method: "POST",
        body: JSON.stringify({
          nombre: f.get("nombre"),
          descripcion: f.get("descripcion") || undefined,
          canal: f.get("canal") || undefined,
          plantilla: plantillaElegida?.id,
        }),
      });
      window.location.href = `/bots/${nuevo.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setGuardando(false);
    }
  }

  async function eliminar(id: string, nombreBot: string) {
    if (!(await confirmDialog(`¿Eliminar el bot "${nombreBot}"? Esta acción no se puede deshacer.`, { textoConfirmar: "Eliminar" }))) return;
    try {
      await api(`/bots/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function desactivar(id: string) {
    try {
      await api(`/bots/${id}/desactivar`, { method: "POST" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Bots</h1>
          <p className="mt-1 text-sm text-muted">Diseña flujos conversacionales con un editor visual de nodos.</p>
        </div>
        <button onClick={abrirPicker} className="btn-primary px-4 py-2 text-sm">+ Nuevo bot</button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      {bots && bots.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><Bot size={22} /></span>
          <p className="text-sm font-medium text-foreground">Todavía no tienes bots</p>
          <p className="max-w-sm text-sm text-muted">Crea tu primer flujo conversacional — arrastra nodos, conéctalos y guárdalo cuando quieras.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bots?.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Bot size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{b.nombre}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      b.activo ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-surface text-muted ring-1 ring-border"
                    }`}>
                      {b.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{b.descripcion || "Sin descripción"}</p>
                  <p className="mt-1.5 text-[10px] text-muted">{b.canal ? CANAL_LABEL[b.canal] ?? b.canal : "Todos los canales"} · Actualizado {fecha(b.updatedAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                {b.activo && (
                  <button onClick={() => desactivar(b.id)} title="Desactivar" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-400">
                    <Power size={13} /> Desactivar
                  </button>
                )}
                <Link href={`/bots/${b.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft">
                  <Pencil size={13} /> Editar
                </Link>
                <button onClick={() => eliminar(b.id, b.nombre)} title="Eliminar" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paso === "elegir" && (
        <div role="presentation" onClick={cerrarModal} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-2xl p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-dark text-white"><Bot size={16} /></span>
              <h2 className="font-display text-base font-semibold text-foreground">Crear bot — elige cómo empezar</h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => elegir(null)}
                className="rounded-xl border border-dashed border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-primary-soft/20"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles size={16} /></span>
                <p className="mt-2 text-sm font-semibold text-foreground">Empezar de cero</p>
                <p className="mt-1 text-xs text-muted">Canvas en blanco con solo el nodo de inicio.</p>
              </button>

              {plantillas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => elegir(p)}
                  className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-primary-soft/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600"><Layers size={16} /></span>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">{p.etiqueta}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{p.nombre}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{p.descripcion}</p>
                  <p className="mt-2 text-[10px] text-muted">{p.nodos} nodos · {p.conexiones} conexiones</p>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={cerrarModal} className="btn-outline px-3 py-2 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {paso === "formulario" && (
        <div role="presentation" onClick={cerrarModal} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-md p-5">
            <div className="flex items-center justify-between">
              <button onClick={() => setPaso("elegir")} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground">
                <ArrowLeft size={13} /> Cambiar plantilla
              </button>
              <button onClick={cerrarModal} className="text-muted hover:text-foreground" aria-label="Cerrar"><X size={16} /></button>
            </div>
            <h2 className="mt-2 font-display text-base font-semibold text-foreground">
              {plantillaElegida ? plantillaElegida.nombre : "Empezar de cero"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {plantillaElegida ? `${plantillaElegida.nodos} nodos · ${plantillaElegida.conexiones} conexiones ya armadas — los podés editar después.` : "Vas a arrancar con un canvas en blanco."}
            </p>

            <form onSubmit={crear} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Nombre</span>
                <input name="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Bienvenida" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Descripción (opcional)</span>
                <input name="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Nota interna sobre qué hace este bot" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Canal (opcional)</span>
                <select name="canal" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                  <option value="">Todos los canales</option>
                  <option value="WHATSAPP_API">WhatsApp Business</option>
                  <option value="MESSENGER">Messenger</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={cerrarModal} className="btn-outline px-3 py-2 text-sm">Cancelar</button>
                <button disabled={guardando} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  {guardando ? "Creando…" : "Crear y abrir el editor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
