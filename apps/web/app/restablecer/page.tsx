"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { api } from "@/lib/api";

function RestablecerForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    if (!token) return setError("Falta el token del link. Solicita uno nuevo.");

    setCargando(true);
    try {
      await api("/auth/reset-password", { auth: false, method: "POST", body: JSON.stringify({ token, password }) });
      setListo(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <KeyRound size={22} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-foreground">Link inválido</h1>
        <p className="mt-2 text-sm text-muted">Este link no tiene el token necesario. Solicita uno nuevo.</p>
        <Link href="/recuperar" className="btn-primary mt-6 inline-flex px-4 py-2.5 text-sm">
          Solicitar nuevo link
        </Link>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <CheckCircle2 size={22} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-foreground">Contraseña actualizada</h1>
        <p className="mt-2 text-sm text-muted">Ya podés iniciar sesión con tu nueva contraseña. Te llevamos al login…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-xl font-bold text-foreground">Elige tu nueva contraseña</h1>
      <p className="mt-1.5 text-sm text-muted">Debe tener al menos 8 caracteres.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Nueva contraseña</span>
          <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Lock size={16} className="shrink-0 text-muted" />
            <input
              type={verPass ? "text" : "password"}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
            />
            <button type="button" onClick={() => setVerPass((v) => !v)} className="text-muted transition hover:text-primary" aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
              {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Confirmar contraseña</span>
          <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Lock size={16} className="shrink-0 text-muted" />
            <input
              type={verPass ? "text" : "password"}
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
            />
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
        )}

        <button type="submit" disabled={cargando} className="btn-primary w-full py-3 text-base disabled:opacity-50">
          {cargando ? "Guardando…" : "Guardar nueva contraseña"}
        </button>
      </form>
    </>
  );
}

export default function RestablecerPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <Link
        href="/login"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} /> Volver a iniciar sesión
      </Link>

      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-2xl ring-1 ring-border">
        <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
          <RestablecerForm />
        </Suspense>
      </div>
    </div>
  );
}
