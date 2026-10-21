"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { IntegracionCard } from "@/components/integracion-card";
import { confirmDialog } from "@/components/confirm-dialog";
import { MarcaCard } from "@/components/marca-card";
import { api, actualizarSesion, leerSesion, type Sesion } from "@/lib/api";
import { CANALES_MENSAJERIA, type IntegracionEstado } from "@/lib/integraciones";
import { ESTADOS_CONVERSACION, ESTADO_INFO_DEFAULT, etiquetasEfectivas, type EtiquetasConversacion } from "@/lib/mensajes";
import { pipelineEfectivo, type EtapaPipelineDef, type TipoEtapaPipeline } from "@/lib/crm";

interface Organizacion {
  id: string;
  nombre: string;
  etiquetasConversacion: EtiquetasConversacion | null;
  pipelineEtapas: EtapaPipelineDef[] | null;
}

function EtapaCard({
  info, acciones, onCambiar,
}: {
  info: { label: string; color: string; descripcion?: string; tipo: TipoEtapaPipeline };
  acciones?: React.ReactNode;
  onCambiar: (campo: "label" | "color" | "descripcion" | "tipo", valor: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <select
          value={info.tipo}
          onChange={(e) => onCambiar("tipo", e.target.value)}
          className="rounded-md border border-border bg-surface px-1.5 py-1 text-[10px] font-semibold text-foreground outline-none focus:border-primary disabled:opacity-60"
        >
          <option value="ABIERTA">Abierta</option>
          <option value="GANADA">Cuenta como ganada</option>
          <option value="PERDIDA">Cuenta como perdida</option>
        </select>
        {acciones}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <input
          type="color"
          value={info.color}
          onChange={(e) => onCambiar("color", e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed"
        />
        <input
          value={info.label}
          onChange={(e) => onCambiar("label", e.target.value)}
          maxLength={24}
          required
          className="w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
        />
      </div>
      <input
        value={info.descripcion ?? ""}
        onChange={(e) => onCambiar("descripcion", e.target.value)}
        maxLength={140}
        placeholder="Descripción (opcional)"
        className="mb-2 w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-60"
      />
      <span
        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: `${info.color}1f`, color: info.color }}
      >
        {info.label || "—"}
      </span>
    </div>
  );
}

function Field({
  label, hint, className = "", ...p
}: { label: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <input {...p} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60" />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default function ConfiguracionPage() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [org, setOrg] = useState<Organizacion | null>(null);
  const [etiquetas, setEtiquetas] = useState<EtiquetasConversacion>({});
  const [pipelineEtapas, setPipelineEtapas] = useState<EtapaPipelineDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [integraciones, setIntegraciones] = useState<IntegracionEstado[]>([]);

  const cargarIntegraciones = () => api<IntegracionEstado[]>("/integraciones").then(setIntegraciones).catch(() => {});

  useEffect(() => {
    setSesion(leerSesion());
    api<Organizacion>("/organizacion")
      .then((o) => {
        setOrg(o);
        setEtiquetas(etiquetasEfectivas(o.etiquetasConversacion));
        setPipelineEtapas(pipelineEfectivo(o.pipelineEtapas));
      })
      .catch((e) => setError(e.message));
    cargarIntegraciones();
  }, []);

  const puedeEditar = sesion?.rol === "OWNER" || sesion?.rol === "ADMIN";

  function cambiarEtiqueta(estado: keyof EtiquetasConversacion, campo: "label" | "color", valor: string) {
    setEtiquetas((prev) => ({
      ...prev,
      [estado]: { ...(prev[estado] ?? ESTADO_INFO_DEFAULT[estado]), [campo]: valor },
    }));
  }

  function cambiarEtapa(id: string, campo: "label" | "color" | "descripcion" | "tipo", valor: string) {
    setPipelineEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)));
  }

  function agregarEtapa() {
    const id = `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setPipelineEtapas((prev) => [...prev, { id, label: "Nueva etapa", color: "#64748b", tipo: "ABIERTA" }]);
  }

  async function eliminarEtapa(id: string) {
    if (!(await confirmDialog("¿Eliminar esta etapa? Si tiene oportunidades, no se podrá guardar hasta moverlas a otra etapa."))) return;
    setPipelineEtapas((prev) => prev.filter((e) => e.id !== id));
  }

  /** Mueve cualquier etapa un lugar antes o después — cualquiera puede reubicarse frente a
   * cualquier otra, incluidas Ganada/Perdida. */
  function moverEtapa(id: string, dir: -1 | 1) {
    setPipelineEtapas((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      const destino = idx + dir;
      if (idx < 0 || destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
      return copia;
    });
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    const body = {
      nombre: String(f.get("nombre") || "") || undefined,
      etiquetasConversacion: etiquetas,
      pipelineEtapas,
    };
    try {
      const actualizado = await api<Organizacion>("/organizacion", { method: "PATCH", body: JSON.stringify(body) });
      setOrg(actualizado);
      setEtiquetas(etiquetasEfectivas(actualizado.etiquetasConversacion));
      setPipelineEtapas(pipelineEfectivo(actualizado.pipelineEtapas));
      actualizarSesion({ orgNombre: actualizado.nombre });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  if (!org) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  const sinGanada = !pipelineEtapas.some((e) => e.tipo === "GANADA");
  const sinPerdida = !pipelineEtapas.some((e) => e.tipo === "PERDIDA");

  return (
    <AppShell>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted">La marca del sistema, los datos de tu empresa y tus canales de mensajería.</p>
      </div>

      {!puedeEditar && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Solo el propietario o un administrador puede editar esta información.
        </p>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {ok && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Cambios guardados.</p>}

      <MarcaCard puedeEditar={puedeEditar} />

      <form onSubmit={guardar}>
        <fieldset disabled={!puedeEditar} className="contents">
          <div className="card mt-4 p-5">
            <h2 className="font-display text-base font-bold text-foreground">Empresa</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field name="nombre" label="Nombre de la empresa" defaultValue={org.nombre} required />
            </div>
          </div>

          <div className="card mt-4 p-5">
            <h2 className="font-display text-base font-bold text-foreground">Etiquetas de estado de conversación</h2>
            <p className="mt-1 text-xs text-muted">Personaliza el nombre y color de cada estado que ve tu equipo en Mensajes.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ESTADOS_CONVERSACION.map((estado) => {
                const info = etiquetas[estado] ?? ESTADO_INFO_DEFAULT[estado];
                return (
                  <div key={estado} className="rounded-xl border border-border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="color"
                        value={info.color}
                        onChange={(e) => cambiarEtiqueta(estado, "color", e.target.value)}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed"
                      />
                      <input
                        value={info.label}
                        onChange={(e) => cambiarEtiqueta(estado, "label", e.target.value)}
                        maxLength={24}
                        required
                        className="w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
                      />
                    </div>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${info.color}1f`, color: info.color }}
                    >
                      {info.label || ESTADO_INFO_DEFAULT[estado].label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card mt-4 p-5">
            <h2 className="font-display text-base font-bold text-foreground">Etapas del embudo de ventas</h2>
            <p className="mt-1 text-xs text-muted">
              Agrega, quita y reordena libremente las etapas del tablero Kanban — incluidas las de cierre. "Tipo" define qué
              etapas cuentan como ganadas o perdidas para la tasa de conversión, independientemente del nombre que le pongas.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pipelineEtapas.map((etapa, idx) => (
                <EtapaCard
                  key={etapa.id}
                  info={etapa}
                  onCambiar={(campo, valor) => cambiarEtapa(etapa.id, campo, valor)}
                  acciones={
                    puedeEditar ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moverEtapa(etapa.id, -1)}
                          disabled={idx === 0}
                          aria-label="Mover antes"
                          className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverEtapa(etapa.id, 1)}
                          disabled={idx === pipelineEtapas.length - 1}
                          aria-label="Mover después"
                          className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarEtapa(etapa.id)}
                          disabled={pipelineEtapas.length <= 1}
                          aria-label="Eliminar etapa"
                          className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>

            {(sinGanada || sinPerdida) && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                {sinGanada && sinPerdida
                  ? 'Ninguna etapa está marcada como "Ganada" ni "Perdida" — el dashboard y reportes no podrán calcular tasa de conversión.'
                  : sinGanada
                    ? 'Ninguna etapa está marcada como "Cuenta como ganada" — la tasa de conversión mostrará 0%.'
                    : 'Ninguna etapa está marcada como "Cuenta como perdida".'}
              </p>
            )}

            {puedeEditar && (
              <button type="button" onClick={agregarEtapa} className="btn-outline mt-3 px-3 py-2 text-xs">
                + Agregar etapa
              </button>
            )}
          </div>

          {puedeEditar && (
            <button disabled={guardando} className="btn-primary mt-4 px-5 py-2.5 text-sm disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
        </fieldset>
      </form>

      <div className="card mt-4 p-5">
        <h2 className="font-display text-base font-bold text-foreground">Integraciones de mensajería</h2>
        <p className="mt-1 text-xs text-muted">
          Conecta tus canales para que las conversaciones lleguen al módulo de Mensajes. Al guardar, verificamos las credenciales en vivo contra cada plataforma.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CANALES_MENSAJERIA.map((cfg) => {
            const estado = integraciones.find((i) => i.canal === cfg.canal) ?? { canal: cfg.canal, estado: "DESCONECTADO" as const, etiqueta: null, conectadoEn: null };
            return (
              <IntegracionCard key={cfg.canal} cfg={cfg} estado={estado} puedeEditar={puedeEditar} onCambio={cargarIntegraciones} />
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
