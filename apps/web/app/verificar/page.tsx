"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";
import { api, guardarSesion, type LoginResp } from "@/lib/api";

function VerificarContenido() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await api<LoginResp>("/auth/verify-email", { auth: false, method: "POST", body: JSON.stringify({ token }) });
        if (!guardarSesion(r)) throw new Error("Tu usuario no pertenece a la empresa. Pide a un administrador que te agregue al equipo.");
        router.replace("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    })();
  }, [token, router]);

  if (!token || error) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <XCircle size={22} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-foreground">No se pudo verificar</h1>
        <p className="mt-2 text-sm text-muted">{token ? error : "Este link no tiene el token necesario."}</p>
        <Link href="/login" className="btn-primary mt-6 inline-flex px-4 py-2.5 text-sm">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Loader2 size={28} className="mx-auto animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted">Verificando tu correo…</p>
    </div>
  );
}

export default function VerificarPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-2xl ring-1 ring-border">
        <Suspense fallback={<p className="text-center text-sm text-muted">Cargando…</p>}>
          <VerificarContenido />
        </Suspense>
      </div>
    </div>
  );
}
