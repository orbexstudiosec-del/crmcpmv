import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Rangos que un servidor jamás debería alcanzar por una URL que escribió el usuario: loopback,
 * red privada, link-local (incluida la metadata de la nube 169.254.169.254), multicast. */
function esIpInterna(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && esIpInterna(v.slice(7));
  }
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformada: por las dudas, bloquear
  const [a, b] = o;
  return (
    a === 0 || a === 10 || a === 127 || // este host, privada clase A, loopback
    (a === 169 && b === 254) || // link-local y metadata de la nube
    (a === 172 && b >= 16 && b <= 31) || // privada clase B
    (a === 192 && b === 168) || // privada clase C
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // multicast / reservado
  );
}

/** Valida una URL que el servidor va a consultar (ej. el Evolution API de un cliente) para que
 * no se la pueda apuntar a la red interna o a la metadata de la nube (SSRF). Resuelve el DNS y
 * comprueba la IP real, no solo el texto, así `http://metadata.local` que apunte a 169.254.x.x
 * también queda bloqueado. Devuelve la URL normalizada. */
export async function validarUrlExterna(url: string): Promise<string> {
  let u: URL;
  try { u = new URL(url); } catch { throw new BadRequestException('La URL no es válida.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new BadRequestException('La URL debe empezar con http:// o https://');

  const host = u.hostname;
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (ips.length === 0) throw new BadRequestException('No se pudo resolver el servidor de esa URL.');
  if (ips.some(esIpInterna)) throw new BadRequestException('Esa URL apunta a una dirección interna y no está permitida.');
  return u.toString();
}

/** Descarga un archivo de una URL que escribió un usuario (ej. la imagen de un nodo de bot) sin
 * abrir la puerta a SSRF: valida la URL, NO sigue redirecciones (un 302 podría saltar a la red
 * interna después de validar) y corta por tiempo y por tamaño. */
export async function descargarUrlExterna(url: string, opciones: { maxBytes: number; timeoutMs: number }): Promise<{ buffer: Buffer; contentType: string | null }> {
  const segura = await validarUrlExterna(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opciones.timeoutMs);
  try {
    const res = await fetch(segura, { redirect: 'manual', signal: controller.signal });
    if (res.status >= 300 && res.status < 400) throw new BadRequestException('La URL redirige a otra dirección; usa el enlace directo al archivo.');
    if (!res.ok || !res.body) throw new BadRequestException(`No se pudo descargar el archivo (HTTP ${res.status}).`);
    const declarado = Number(res.headers.get('content-length') ?? 0);
    if (declarado > opciones.maxBytes) throw new BadRequestException('El archivo es demasiado grande.');

    const partes: Buffer[] = [];
    let total = 0;
    for await (const parte of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += parte.length;
      if (total > opciones.maxBytes) {
        controller.abort();
        throw new BadRequestException('El archivo es demasiado grande.');
      }
      partes.push(Buffer.from(parte));
    }
    return { buffer: Buffer.concat(partes), contentType: res.headers.get('content-type') };
  } finally {
    clearTimeout(timer);
  }
}
