"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      // El API siempre responde { ok: true } exista o no el correo, para no revelar cuentas registradas.
      await api("/auth/forgot-password", { auth: false, method: "POST", body: JSON.stringify({ email }) });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <Link
        href="/login"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} /> Volver a iniciar sesión
      </Link>

      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-2xl ring-1 ring-border">
        {enviado ? (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 size={22} />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-foreground">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-muted">
              Si <span className="font-medium text-foreground">{email}</span> está registrado, te enviamos un link para restablecer tu contraseña. Es válido por 1 hora.
            </p>
            <Link href="/login" className="btn-primary mt-6 inline-flex px-4 py-2.5 text-sm">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold text-foreground">¿Olvidaste tu contraseña?</h1>
            <p className="mt-1.5 text-sm text-muted">Ingresa tu correo y te enviaremos un link para restablecerla.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">Email</span>
                <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <Mail size={16} className="shrink-0 text-muted" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@empresa.com"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
                  />
                </span>
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
              )}

              <button type="submit" disabled={cargando} className="btn-primary w-full py-3 text-base disabled:opacity-50">
                {cargando ? "Enviando…" : (<><Send size={16} /> Enviar link</>)}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
