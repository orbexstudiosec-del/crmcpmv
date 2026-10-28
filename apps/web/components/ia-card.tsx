"use client";

import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, XCircle, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { confirmDialog } from "@/components/confirm-dialog";

interface EstadoIA {
  origen: "CRM" | "SERVIDOR" | null;
  claveMascara: string | null;
  modelo: string;
}

/** Modelos sugeridos; se puede escribir cualquier otro al que tenga acceso la cuenta. */
const MODELOS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

const CAMPO = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-70";

/** Credenciales de OpenAI que usan las funciones de IA del CRM (por ahora, el Cronopost). La clave
 *  se guarda cifrada en el servidor y nunca vuelve al navegador: aquí solo se ve enmascarada. */
export function IaCard({ puedeEditar }: { puedeEditar: boolean }) {
  const [estado, setEstado] = useState<EstadoIA | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [ocupado, setOcupado] = useState<"guardar" | "probar" | "quitar" | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    api<EstadoIA>("/ia/configuracion")
      .then((e) => { setEstado(e); setModelo(e.modelo); })
      .catch(() => {});
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setOcupado("guardar");
    try {
      const r = await api<EstadoIA>("/ia/configuracion", {
        method: "PUT",
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, modelo: modelo.trim() }),
      });
      setEstado(r);
      setApiKey("");
      setMensaje({ texto: `Conexión verificada y guardada (modelo ${r.modelo}).`, ok: true });
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : "No se pudo guardar", ok: false });
    } finally {
      setOcupado(null);
    }
  }

  async function probar() {
    setMensaje(null);
    setOcupado("probar");
    try {
      const r = await api<{ modelo: string }>("/ia/probar", { method: "POST" });
      setMensaje({ texto: `La conexión con OpenAI funciona (modelo ${r.modelo}).`, ok: true });
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : "La prueba falló", ok: false });
    } finally {
      setOcupado(null);
    }
  }

  async function quitar() {
    const conServidor = "Se usará la clave configurada en el servidor.";
    if (!(await confirmDialog(`Se borrará la API key guardada en el CRM. ${estado?.origen === "CRM" ? "" : conServidor}`.trim(), { titulo: "¿Quitar la API key?", textoConfirmar: "Quitar" }))) return;
    setMensaje(null);
    setOcupado("quitar");
    try {
      const r = await api<EstadoIA>("/ia/configuracion", { method: "DELETE" });
      setEstado(r);
      setModelo(r.modelo);
      setMensaje({ texto: r.origen === "SERVIDOR" ? "Se quitó la clave del CRM; ahora se usa la del servidor." : "Se quitó la clave: las funciones de IA quedan desactivadas.", ok: true });
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : "No se pudo quitar", ok: false });
    } finally {
      setOcupado(null);
    }
  }

  const configurada = estado?.origen != null;

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Sparkles size={16} className="text-primary" /> Inteligencia artificial (OpenAI)
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Activa las funciones de IA del CRM: propuestas de copy y plan semanal o mensual del Cronopost.
          </p>
        </div>
        {estado && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${configurada ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20" : "bg-surface text-muted ring-1 ring-border"}`}>
            {configurada ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {estado.origen === "CRM" ? "Configurada" : estado.origen === "SERVIDOR" ? "Clave del servidor" : "Sin configurar"}
          </span>
        )}
      </div>

      {configurada && estado && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><KeyRound size={12} /> <code className="text-foreground">{estado.claveMascara}</code></span>
          <span>Modelo: <span className="font-medium text-foreground">{estado.modelo}</span></span>
          {estado.origen === "SERVIDOR" && <span>Se toma de la configuración del servidor (.env). Puedes cargar otra aquí.</span>}
        </p>
      )}

      {puedeEditar ? (
        <form onSubmit={guardar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">API key de OpenAI</span>
            <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:border-primary">
              <input
                type={verClave ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={estado?.origen === "CRM" ? "Deja vacío para mantener la clave actual" : "sk-…"}
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
              <button type="button" onClick={() => setVerClave((v) => !v)} className="text-muted hover:text-primary" aria-label={verClave ? "Ocultar clave" : "Mostrar clave"}>
                {verClave ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
            <span className="mt-1 block text-[11px] text-muted">
              Se crea en platform.openai.com → API keys. Se guarda cifrada y nadie puede volver a verla completa.
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">Modelo</span>
            <input list="modelos-ia" value={modelo} onChange={(e) => setModelo(e.target.value)} required maxLength={60} className={CAMPO} />
            <datalist id="modelos-ia">{MODELOS.map((m) => <option key={m} value={m} />)}</datalist>
          </label>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button disabled={ocupado !== null || (!apiKey.trim() && estado?.origen !== "CRM")} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {ocupado === "guardar" ? <><Loader2 size={14} className="animate-spin" /> Verificando…</> : "Guardar y verificar"}
            </button>
            {configurada && (
              <button type="button" onClick={probar} disabled={ocupado !== null} className="btn-outline px-4 py-2 text-sm disabled:opacity-50">
                {ocupado === "probar" ? <><Loader2 size={14} className="animate-spin" /> Probando…</> : "Probar conexión"}
              </button>
            )}
            {estado?.origen === "CRM" && (
              <button type="button" onClick={quitar} disabled={ocupado !== null} className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10">
                Quitar API key
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted">Solo el propietario o un administrador puede configurar la IA.</p>
      )}

      {mensaje && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${mensaje.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-500/10"}`}>
          {mensaje.texto}
        </p>
      )}

      <p className="mt-3 text-[11px] text-muted">
        A OpenAI solo se envía lo que se escribe para generar contenido (configuración de la marca, temas e indicaciones), nunca datos de socios ni prospectos. El uso se factura en la cuenta de OpenAI dueña de la clave.
      </p>
    </section>
  );
}
