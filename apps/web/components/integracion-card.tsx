"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { confirmDialog } from "@/components/confirm-dialog";
import type { CanalConfig, IntegracionEstado } from "@/lib/integraciones";

const ESTADO_ESTILO: Record<string, string> = {
  CONECTADO: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
  PENDIENTE: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
  ERROR: "bg-red-50 text-red-600 ring-1 ring-red-200",
  DESCONECTADO: "bg-surface text-muted ring-1 ring-border",
};
const ESTADO_LABEL: Record<string, string> = {
  CONECTADO: "Conectado",
  PENDIENTE: "Pendiente",
  ERROR: "Error de conexión",
  DESCONECTADO: "Desconectado",
};

interface RespuestaConectar extends IntegracionEstado {
  webhookUrl?: string;
  webhookAdvertencia?: string | null;
}

export function IntegracionCard({
  cfg, estado, puedeEditar, onCambio,
}: { cfg: CanalConfig; estado: IntegracionEstado; puedeEditar: boolean; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [avisoWebhook, setAvisoWebhook] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function conectarCon(credenciales: Record<string, string>) {
    setError(null);
    setAvisoWebhook(null);
    setWebhookUrl(null);
    setGuardando(true);
    try {
      const r = await api<RespuestaConectar>("/integraciones", {
        method: "POST",
        body: JSON.stringify({ canal: cfg.canal, credenciales }),
      });
      if (r.webhookAdvertencia) setAvisoWebhook(r.webhookAdvertencia);
      if (r.webhookUrl) {
        // Conectado, pero falta un paso manual en Meta (pegar esta URL) para que los
        // mensajes entrantes lleguen.
        setWebhookUrl(r.webhookUrl);
        onCambio();
      } else {
        setAbierto(false);
        onCambio();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar");
    } finally {
      setGuardando(false);
    }
  }

  async function copiarWebhookUrl() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  function conectar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const credenciales: Record<string, string> = {};
    for (const campo of cfg.campos) {
      const v = String(f.get(campo.name) || "");
      if (v) credenciales[campo.name] = v;
    }
    return conectarCon(credenciales);
  }

  function alternarAbierto() {
    if (abierto) return cancelar();
    setAbierto(true);
  }

  async function desconectar() {
    if (!(await confirmDialog(`¿Desconectar ${cfg.label}?`))) return;
    try {
      await api(`/integraciones/${cfg.canal}`, { method: "DELETE" });
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function cancelar() {
    setWebhookUrl(null);
    setError(null);
    setAvisoWebhook(null);
    setAbierto(false);
  }

  const conectado = estado.estado === "CONECTADO";

  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-shadow hover:shadow-md ${
        conectado ? "border-l-[3px] border-emerald-400 dark:border-emerald-500" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.claseIcono}`}>
          <cfg.icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{cfg.label}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_ESTILO[estado.estado]}`}>
              {estado.estado === "CONECTADO" ? <CheckCircle2 size={10} /> : estado.estado === "ERROR" ? <XCircle size={10} /> : estado.estado === "PENDIENTE" ? <Clock size={10} /> : null}
              {ESTADO_LABEL[estado.estado]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">{cfg.desc}</p>
          {estado.estado === "CONECTADO" && estado.etiqueta && (
            <p className="mt-1 text-xs font-medium text-foreground">{estado.etiqueta}</p>
          )}
        </div>
        {puedeEditar && (
          <div className="shrink-0">
            {conectado ? (
              <button
                onClick={desconectar}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                Desconectar
              </button>
            ) : (
              <button
                onClick={alternarAbierto}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  abierto ? "bg-surface text-muted hover:text-foreground" : "bg-primary-soft text-primary hover:bg-primary hover:text-white"
                }`}
              >
                {abierto ? "Cancelar" : "Conectar"}
              </button>
            )}
          </div>
        )}
      </div>

      {abierto && (
        <div className="mt-3 border-t border-border pt-3">
          {error && <p className="mb-2.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          {webhookUrl ? (
            <div className="flex flex-col gap-2 py-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} /> Conectado — falta un paso para recibir mensajes
              </p>
              <p className="text-xs text-muted">
                Pega esta URL en Meta for Developers → tu app → WhatsApp → Configuración → Webhook (con el mismo &quot;Verify token&quot; que pusiste acá), y suscribite al campo <code className="rounded bg-surface px-1 py-0.5">messages</code>.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{webhookUrl}</span>
                <button type="button" onClick={copiarWebhookUrl} className="shrink-0 text-muted hover:text-foreground" title="Copiar">
                  {copiado ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
              {avisoWebhook && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">No pudimos suscribir tu cuenta automáticamente a los eventos: {avisoWebhook}</p>
              )}
              <button type="button" onClick={() => { setWebhookUrl(null); setAbierto(false); }} className="btn-outline mt-1 py-1.5 text-xs">
                Listo
              </button>
            </div>
          ) : (
            <form onSubmit={conectar} className="space-y-2.5">
              {cfg.campos.map((campo) => (
                <label key={campo.name} className="block">
                  <span className="mb-1 block text-xs font-medium text-foreground">
                    {campo.label}{campo.opcional ? " (opcional)" : ""}
                  </span>
                  <input
                    name={campo.name}
                    type={campo.type ?? "text"}
                    placeholder={campo.placeholder}
                    required={!campo.opcional}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </label>
              ))}
              <button disabled={guardando} className="btn-primary w-full justify-center py-1.5 text-xs disabled:opacity-50">
                {guardando ? <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Verificando…</span> : "Guardar y verificar"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
