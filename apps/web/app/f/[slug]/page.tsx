"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { PAISES } from "@/lib/paises";
import { CampoFormularioInput, INPUT_CLASE as INPUT, LABEL_CLASE as LABEL, type CampoFormularioVista } from "@/components/formulario-lead-campo";

interface FormularioPublico {
  nombre: string;
  descripcion: string | null;
  mensajeExito: string | null;
  campos: CampoFormularioVista[];
}

export default function FormularioPublicoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [estado, setEstado] = useState<"cargando" | "listo" | "error" | "enviado">("cargando");
  const [error, setError] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioPublico | null>(null);

  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState("+593");
  const [numero, setNumero] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string | string[]>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api<FormularioPublico>(`/formularios-lead/publico/${slug}`, { auth: false })
      .then((d) => { setFormulario(d); setEstado("listo"); })
      .catch((e) => { setError(e instanceof Error ? e.message : "Error"); setEstado("error"); });
  }, [slug]);

  function setRespuesta(campoId: string, valor: string | string[]) {
    setRespuestas((r) => ({ ...r, [campoId]: valor }));
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(`/formularios-lead/publico/${slug}`, {
        auth: false,
        method: "POST",
        body: JSON.stringify({
          nombre,
          telefono: `${pais}${numero.replace(/\D/g, "")}`,
          respuestas,
          _hp: f.get("sitio_web") || undefined,
        }),
      });
      setEstado("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-2xl ring-1 ring-border">
        {estado === "cargando" && (
          <div className="text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted">Cargando formulario…</p>
          </div>
        )}

        {estado === "error" && (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <XCircle size={22} />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-foreground">Formulario no disponible</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        )}

        {estado === "enviado" && (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 size={22} />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-foreground">¡Listo!</h1>
            <p className="mt-2 text-sm text-muted">{formulario?.mensajeExito || "Gracias por tu información, en breve nos pondremos en contacto."}</p>
          </div>
        )}

        {estado === "listo" && formulario && (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><ClipboardList size={17} /></span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold text-foreground">{formulario.nombre}</h1>
              </div>
            </div>
            {formulario.descripcion && <p className="mt-2 text-sm text-muted">{formulario.descripcion}</p>}

            <form onSubmit={enviar} className="mt-5 space-y-3">
              {/* Honeypot — invisible para una persona, un bot que rellena todo lo encuentra igual. */}
              <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                <label>
                  Sitio web
                  <input name="sitio_web" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <label className="block">
                <span className={LABEL}>Nombre</span>
                <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT} placeholder="Tu nombre" />
              </label>

              <div className="block">
                <span className={LABEL}>Teléfono / WhatsApp</span>
                <div className="flex gap-2">
                  <select value={pais} onChange={(e) => setPais(e.target.value)} className="w-24 shrink-0 rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus:border-primary">
                    {PAISES.map((p) => <option key={p.iso} value={p.dial}>{p.dial}</option>)}
                  </select>
                  <input required type="tel" inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value.replace(/[^\d\s-]/g, ""))} placeholder="99 999 9999" className={`${INPUT} min-w-0 flex-1`} />
                </div>
              </div>

              {formulario.campos.map((campo) => (
                <CampoFormularioInput
                  key={campo.id}
                  campo={campo}
                  valor={respuestas[campo.id]}
                  onChange={(valor) => setRespuesta(campo.id, valor)}
                />
              ))}

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

              <button disabled={enviando} className="btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50">
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
