"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Mail, Lock, Eye, EyeOff, LogIn, MapPin, MessageSquare, TrendingUp, ShieldCheck, ArrowLeft } from "lucide-react";
import { api, guardarSesion, type LoginDesafio, type LoginResp } from "@/lib/api";
import { MarcaLogo, useMarca } from "@/lib/marca";

export default function LoginPage() {
  const router = useRouter();
  const { marca } = useMarca();
  const [datos, setDatos] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  /** Paso 2: la contraseña fue correcta y se mandó un código al correo institucional. */
  const [desafio, setDesafio] = useState<LoginDesafio | null>(null);
  const [codigo, setCodigo] = useState("");
  const [reenviado, setReenviado] = useState(false);

  const set =
    (k: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDatos((d) => ({ ...d, [k]: e.target.value }));

  /** Paso 1. También sirve para pedir un código nuevo: repite la contraseña ya escrita. */
  async function pedirCodigo() {
    setError(null);
    setCargando(true);
    try {
      const r = await api<LoginDesafio>("/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ email: datos.email, password: datos.password }),
      });
      setDesafio(r);
      setCodigo("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setCargando(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReenviado(false);
    await pedirCodigo();
  }

  async function reenviarCodigo() {
    if (await pedirCodigo()) setReenviado(true);
  }

  /** Paso 2. */
  async function onSubmitCodigo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!desafio) return;
    setError(null);
    setCargando(true);
    try {
      const r = await api<LoginResp>("/auth/login/codigo", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ desafio: desafio.desafio, codigo }),
      });
      if (!guardarSesion(r)) throw new Error("Tu usuario no pertenece a la cooperativa. Pide a un administrador que te agregue al equipo.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  function volver() {
    setDesafio(null);
    setCodigo("");
    setError(null);
    setReenviado(false);
  }

  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-[0.95fr_1fr]">
      <Showcase />

      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <MarcaLogo className="h-12 self-start lg:hidden" />

          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary lg:mt-0">{marca.nombre}</p>
          {desafio ? (
            <>
              <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-foreground">Revisa tu correo</h1>
              <p className="mt-1.5 text-sm text-muted">
                Enviamos un código de 6 dígitos a <span className="font-medium text-foreground">{desafio.correo}</span>. Vence en 10 minutos.
              </p>

              <form onSubmit={onSubmitCodigo} className="mt-6 space-y-4">
                <Field name="codigo" label="Código de acceso" icon={ShieldCheck} required autoFocus
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}"
                  placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
                )}
                {reenviado && !error && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Te enviamos un código nuevo.</p>
                )}
                <button type="submit" disabled={cargando || codigo.length !== 6} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
                  {cargando ? "Verificando…" : (<><LogIn size={16} /> Ingresar</>)}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button type="button" onClick={volver} className="inline-flex items-center gap-1 font-medium text-muted hover:text-foreground">
                  <ArrowLeft size={13} /> Cambiar de usuario
                </button>
                <button type="button" onClick={reenviarCodigo} disabled={cargando} className="font-medium text-primary hover:underline disabled:opacity-50">
                  Enviar otro código
                </button>
              </div>
            </>
          ) : (
          <>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-foreground">Ingresa a tu cuenta</h1>
          <p className="mt-1.5 text-sm text-muted">Revisa los prospectos de tu agencia y dales seguimiento.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field name="email" type="email" label="Correo institucional" icon={Mail} required autoFocus autoComplete="username"
              placeholder="tu correo de la cooperativa" value={datos.email} onChange={set("email")} />
            <Field name="password" type={verPass ? "text" : "password"} label="Contraseña" icon={Lock} required
              autoComplete="current-password" placeholder="••••••••" value={datos.password} onChange={set("password")}
              labelRight={
                <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              }
              trailing={
                <button type="button" onClick={() => setVerPass((v) => !v)}
                  className="text-muted transition hover:text-primary"
                  aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
            )}
            <button type="submit" disabled={cargando} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
              {cargando ? "Enviando código…" : (<><LogIn size={16} /> Continuar</>)}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            ¿No tienes usuario? Solicítalo al administrador del sistema.
          </p>
          </>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-muted lg:hidden">
          Cooperativa de Ahorro y Crédito Pablo Muñoz Vega
        </p>
      </main>
    </div>
  );
}

/** Panel institucional: de qué trata el sistema para quien entra a trabajar en él. */
function Showcase() {
  const puntos: { icon: LucideIcon; titulo: string; texto: string }[] = [
    { icon: MapPin, titulo: "Cada prospecto, a su agencia", texto: "Según la ciudad del interesado, llega directo a la agencia que lo atiende." },
    { icon: MessageSquare, titulo: "Todas las conversaciones juntas", texto: "WhatsApp y redes sociales en una sola bandeja, sin perder ningún mensaje." },
    { icon: TrendingUp, titulo: "Seguimiento hasta el cierre", texto: "Del primer contacto al nuevo socio, con cada gestión registrada." },
  ];

  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy to-navy-dark p-10 text-white lg:flex xl:p-14">
      {/* Arcos decorativos que retoman la curva amarilla del logo. Cada uno flota despacio y
          lleva un destello que recorre el trazo (animaciones en globals.css, sección "Login"). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="login-flotar absolute -right-52 -top-64 h-[30rem] w-[30rem]">
          <div className="absolute inset-0 rounded-full border border-accent/30" />
          <div className="login-destello absolute inset-0 rounded-full text-accent" />
        </div>
        <div className="login-flotar-lento absolute -right-64 -top-72 h-[38rem] w-[38rem]">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="login-destello login-destello-inverso absolute inset-0 rounded-full text-white/70" />
        </div>
        <div className="login-flotar-lento absolute -bottom-56 -left-56 h-[26rem] w-[26rem]">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="login-destello absolute inset-0 rounded-full text-accent/70" />
        </div>
        <div className="login-respirar absolute -bottom-48 -left-48 h-[30rem] w-[30rem] rounded-full bg-primary/40 blur-3xl" />
      </div>
      <MarcaLogo claro className="relative z-10 h-12 self-start" />

      <div className="relative z-10 max-w-md">
        <span className="inline-block h-1 w-10 rounded-full bg-accent" />
        <h2 className="mt-4 font-display text-[1.7rem] font-extrabold leading-[1.15] tracking-tight xl:text-[2rem]">
          Todos los prospectos de la cooperativa, <span className="text-accent">en un solo lugar.</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          Cada persona interesada en nuestros productos queda registrada, llega a la agencia de su ciudad y recibe seguimiento hasta convertirse en socio.
        </p>

        <ul className="mt-7 space-y-4">
          {puntos.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon size={16} className="text-accent" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{titulo}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-white/65">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-xs text-white/45">Cooperativa de Ahorro y Crédito Pablo Muñoz Vega</p>
    </aside>
  );
}

function Field({
  label,
  icon: Icon,
  trailing,
  labelRight,
  ...props
}: {
  label: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  labelRight?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {labelRight}
      </span>
      <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        {Icon && <Icon size={16} className="shrink-0 text-muted" />}
        <input
          {...props}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
        />
        {trailing}
      </span>
    </label>
  );
}
