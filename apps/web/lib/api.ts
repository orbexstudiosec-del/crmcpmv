'use client';

// Mismo origen por defecto: Caddy (producción) o el rewrite de next.config.ts (desarrollo)
// llevan /api al backend. Así la imagen no queda atada al dominio de una instalación.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/+$/, '');

/** Convierte una ruta relativa que devuelve el API (algo como "/api/uploads/...") en una URL
 *  que el navegador pueda cargar directo. */
export function urlArchivo(rutaRelativa: string): string {
  return `${API_URL.replace(/\/api$/, '')}${rutaRelativa}`;
}

export interface Sesion {
  token: string;
  organizationId: string;
  nombre: string;
  email: string;
  rol: string;
  orgNombre: string;
}

/** Respuesta de /auth/login (paso 1): la contraseña es correcta y se envió un código al correo. */
export interface LoginDesafio {
  requiereCodigo: true;
  desafio: string;
  /** Correo enmascarado al que se mandó el código, para mostrarlo en pantalla. */
  correo: string;
}

/** Respuesta de /auth/login/codigo (paso 2): la sesión. */
export interface LoginResp {
  token: string;
  user: { nombre: string; email: string };
  organizaciones: { organizationId: string; rol: string; nombre: string }[];
}

const KEY = 'crm.sesion';
export const EVENTO_SESION = 'crm:sesion';

/** Guarda la sesión a partir de la respuesta de login. Devuelve false si el usuario no
 *  pertenece a la empresa de esta instalación (no hay nada que abrirle). */
export function guardarSesion(r: LoginResp): boolean {
  const org = r.organizaciones[0];
  if (!org) return false;
  const sesion: Sesion = {
    token: r.token,
    organizationId: org.organizationId,
    nombre: r.user.nombre,
    email: r.user.email,
    rol: org.rol,
    orgNombre: org.nombre,
  };
  localStorage.setItem(KEY, JSON.stringify(sesion));
  window.dispatchEvent(new Event(EVENTO_SESION));
  return true;
}

export function leerSesion(): Sesion | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Sesion) : null;
}

/** Actualiza campos de la sesión guardada (p. ej. el nombre de la empresa tras editarlo). */
export function actualizarSesion(cambios: Partial<Sesion>) {
  const actual = leerSesion();
  if (!actual) return;
  localStorage.setItem(KEY, JSON.stringify({ ...actual, ...cambios }));
  window.dispatchEvent(new Event(EVENTO_SESION));
}

export function cerrarSesion() {
  localStorage.removeItem(KEY);
}

/** Petición autenticada al API. Inyecta Bearer + X-Org-Id desde la sesión. */
export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json');

  if (auth) {
    const s = leerSesion();
    if (s) {
      h.set('Authorization', `Bearer ${s.token}`);
      h.set('X-Org-Id', s.organizationId);
    }
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: h });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      msg = body.message ?? msg;
    } catch {
      /* sin cuerpo JSON */
    }
    // Sesión inválida o expirada (JwtAuthGuard) — la única salida es re-loguearse, así que
    // limpiamos la sesión guardada y mandamos a /login en vez de dejar la pantalla colgada en
    // "Cargando…" o reintentando en bucle.
    if (auth && res.status === 401) {
      cerrarSesion();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
