"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ClipboardList, Pencil, Trash2, Share2, Copy, Check, Download, X, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";

interface FormularioLead {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  createdAt: string;
  _count: { leads: number };
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FormulariosPage() {
  const [formularios, setFormularios] = useState<FormularioLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [compartiendo, setCompartiendo] = useState<FormularioLead | null>(null);

  const cargar = () => api<FormularioLead[]>("/formularios-lead").then(setFormularios).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const nuevo = await api<FormularioLead>("/formularios-lead", {
        method: "POST",
        body: JSON.stringify({ nombre, campos: [] }),
      });
      window.location.href = `/formularios/${nuevo.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setGuardando(false);
    }
  }

  async function eliminar(id: string, nombreFormulario: string) {
    if (!(await confirmDialog(`¿Eliminar el formulario "${nombreFormulario}"? Los leads ya capturados se conservan, pero pierden el vínculo con este formulario.`, { textoConfirmar: "Eliminar" }))) return;
    try {
      await api(`/formularios-lead/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function toggleActivo(f: FormularioLead) {
    try {
      await api(`/formularios-lead/${f.id}`, { method: "PATCH", body: JSON.stringify({ nombre: f.nombre, activo: !f.activo, campos: [] }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Formularios</h1>
          <p className="mt-1 text-sm text-muted">Captura leads por QR o link — cada formulario agrupa a sus leads, listos para una campaña de WhatsApp.</p>
        </div>
        <button onClick={() => { setNombre(""); setAbierto(true); }} className="btn-primary px-4 py-2 text-sm">+ Nuevo formulario</button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      {formularios && formularios.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><ClipboardList size={22} /></span>
          <p className="text-sm font-medium text-foreground">Todavía no tienes formularios</p>
          <p className="max-w-sm text-sm text-muted">Crea uno para una feria, activación BTL o campaña en redes — los leads que capture quedan agrupados y listos para una campaña de WhatsApp.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {formularios?.map((f) => (
            <div key={f.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><ClipboardList size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{f.nombre}</h3>
                    <button
                      onClick={() => toggleActivo(f)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                        f.activo ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-surface text-muted ring-1 ring-border"
                      }`}
                    >
                      {f.activo ? "Activo" : "Inactivo"}
                    </button>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><Users size={12} /> {f._count.leads} lead{f._count.leads === 1 ? "" : "s"} capturado{f._count.leads === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-[10px] text-muted">Creado {fecha(f.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                <button onClick={() => setCompartiendo(f)} title="Compartir" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-foreground">
                  <Share2 size={13} /> Compartir
                </button>
                <Link href={`/formularios/${f.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft">
                  <Pencil size={13} /> Editar
                </Link>
                <button onClick={() => eliminar(f.id, f.nombre)} title="Eliminar" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <div role="presentation" onClick={() => setAbierto(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-md p-5">
            <h2 className="font-display text-base font-semibold text-foreground">Nuevo formulario</h2>
            <p className="mt-1 text-xs text-muted">Dale un nombre — luego agregas las preguntas en el editor.</p>
            <form onSubmit={crear} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Nombre</span>
                <input
                  required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Feria Norte 2026"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAbierto(false)} className="btn-outline px-3 py-2 text-sm">Cancelar</button>
                <button disabled={guardando} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  {guardando ? "Creando…" : "Crear y abrir el editor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {compartiendo && <CompartirModal formulario={compartiendo} onClose={() => setCompartiendo(null)} />}
    </AppShell>
  );
}

export function CompartirModal({ formulario, onClose }: { formulario: { nombre: string; slug: string }; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/f/${formulario.slug}` : "";

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 260, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [url]);

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  function descargar() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `qr-${formulario.slug}.png`;
    a.click();
  }

  return (
    <div role="presentation" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-sm p-5 text-center">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">Compartir &quot;{formulario.nombre}&quot;</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Cerrar"><X size={16} /></button>
        </div>
        <p className="mt-1 text-left text-xs text-muted">Compártelo por link o imprime el código QR para una feria o activación BTL.</p>

        <div className="mt-4 flex justify-center">
          {qr ? <img src={qr} alt="Código QR del formulario" className="h-56 w-56 rounded-xl ring-1 ring-border" /> : <div className="h-56 w-56 animate-pulse rounded-xl bg-surface" />}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-left text-xs text-foreground">{url}</span>
          <button onClick={copiar} className="shrink-0 text-muted hover:text-foreground" title="Copiar link">
            {copiado ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          </button>
        </div>

        <button onClick={descargar} disabled={!qr} className="btn-outline mt-3 inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50">
          <Download size={14} /> Descargar QR (PNG)
        </button>
      </div>
    </div>
  );
}
