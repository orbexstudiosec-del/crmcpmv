import { MARCA_NOMBRE_DEFAULT, type Marca } from "@totalcrm/shared";

/** URL del API vista desde el servidor de Next (dentro de Docker es el nombre del servicio,
 * no el dominio público). */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");

/** Pide la marca al API en cada request. Si el API no responde (arrancando, caído), cae al
 * nombre que dejó el instalador en APP_NAME para que la página siga cargando con la marca
 * correcta en vez de romperse. */
export async function obtenerMarca(): Promise<Marca> {
  const respaldo: Marca = { nombre: process.env.APP_NAME?.trim() || MARCA_NOMBRE_DEFAULT, colorPrimario: null, colorSecundario: null, logo: null, icono: null };
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/marca`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return respaldo;
    return (await res.json()) as Marca;
  } catch {
    return respaldo;
  }
}
