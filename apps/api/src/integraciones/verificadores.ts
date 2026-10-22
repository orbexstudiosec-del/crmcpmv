import { BadRequestException } from '@nestjs/common';
import type {
  CredencialesWhatsappApi, CredencialesMessenger,
  CredencialesInstagram, CredencialesTiktok,
} from '@totalcrm/shared';

const GRAPH = 'https://graph.facebook.com/v20.0';
const TIMEOUT_MS = 10_000;

/** Cada verificador hace una llamada real a la plataforma para confirmar que las
 * credenciales sirven, y devuelve una etiqueta legible (sin secretos) para la UI.
 * Si la plataforma rechaza las credenciales o no responde, lanza un error real —
 * nunca se simula una conexión exitosa. Con timeout: sin esto, un servidor que no
 * responde (en vez de rechazar) deja la petición colgada indefinidamente. */
async function fetchVerificado(url: string, init: RequestInit, mensajeSinRespuesta: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new BadRequestException(mensajeSinRespuesta);
  } finally {
    clearTimeout(timer);
  }
}

export async function verificarWhatsappApi(c: CredencialesWhatsappApi): Promise<string> {
  const res = await fetchVerificado(
    `${GRAPH}/${c.phoneNumberId}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(c.accessToken)}`,
    {},
    'No se pudo contactar la API de Meta (tiempo de espera agotado).',
  );
  if (!res.ok) throw new BadRequestException('Meta rechazó el Phone Number ID o el token de acceso.');
  const body = (await res.json()) as { display_phone_number?: string; verified_name?: string };
  return body.display_phone_number ?? c.phoneNumberId;
}

export async function verificarMessenger(c: CredencialesMessenger): Promise<string> {
  const res = await fetchVerificado(
    `${GRAPH}/${c.pageId}?fields=name&access_token=${encodeURIComponent(c.pageAccessToken)}`,
    {},
    'No se pudo contactar la API de Meta (tiempo de espera agotado).',
  );
  if (!res.ok) throw new BadRequestException('Meta rechazó el ID de página o el token de acceso.');
  const body = (await res.json()) as { name?: string };
  return body.name ?? c.pageId;
}

export async function verificarInstagram(c: CredencialesInstagram): Promise<string> {
  const res = await fetchVerificado(
    `${GRAPH}/${c.igBusinessId}?fields=username&access_token=${encodeURIComponent(c.accessToken)}`,
    {},
    'No se pudo contactar la API de Meta (tiempo de espera agotado).',
  );
  if (!res.ok) throw new BadRequestException('Meta rechazó el ID de cuenta de Instagram o el token de acceso.');
  const body = (await res.json()) as { username?: string };
  return body.username ? `@${body.username}` : c.igBusinessId;
}

export async function verificarTiktok(c: CredencialesTiktok): Promise<string> {
  if (!c.accessToken) {
    // Sin access token todavía no hay nada que verificar contra TikTok (falta completar el
    // flujo OAuth); guardamos las claves de app como "pendiente" con la clave como etiqueta.
    return c.clientKey;
  }
  const res = await fetchVerificado(
    'https://business-api.tiktok.com/open_api/v1.3/user/info/',
    { headers: { 'Access-Token': c.accessToken } },
    'No se pudo contactar la API de TikTok Business (tiempo de espera agotado).',
  );
  if (!res.ok) throw new BadRequestException('TikTok rechazó el access token.');
  const body = (await res.json()) as { data?: { display_name?: string } };
  return body.data?.display_name ?? c.clientKey;
}
