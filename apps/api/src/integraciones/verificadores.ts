import { BadRequestException } from '@nestjs/common';
import type {
  CredencialesWhatsappQrResueltas, CredencialesWhatsappApi, CredencialesMessenger,
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

export interface ResultadoWhatsappQr {
  estado: 'CONECTADO' | 'PENDIENTE';
  etiqueta: string;
  qrCode?: string; // data URL "data:image/png;base64,..." — solo cuando estado=PENDIENTE
}

async function numeroConectado(base: string, apikey: string, instancia: string): Promise<string | null> {
  try {
    const res = await fetchVerificado(`${base}/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`, { headers: { apikey } }, '');
    if (!res.ok) return null;
    const lista = (await res.json()) as { ownerJid?: string | null }[];
    const jid = lista[0]?.ownerJid;
    return jid ? `+${jid.split('@')[0]}` : null;
  } catch {
    return null;
  }
}

/** Crea la instancia en Evolution API si no existe todavía, y devuelve un código QR real
 * para emparejar (o confirma que ya está conectada). Nunca marca CONECTADO sin que Evolution
 * reporte state === "open". */
export async function conectarWhatsappQr(c: CredencialesWhatsappQrResueltas): Promise<ResultadoWhatsappQr> {
  const base = c.evolutionApiUrl.replace(/\/+$/, '');
  const headers = { apikey: c.evolutionApiKey };

  const estadoRes = await fetchVerificado(
    `${base}/instance/connectionState/${encodeURIComponent(c.instancia)}`,
    { headers },
    'No se pudo contactar tu servidor Evolution API (tiempo de espera agotado o URL incorrecta).',
  );

  if (estadoRes.status === 404) {
    // La instancia no existe todavía en tu servidor: la creamos. Evolution devuelve el QR en la misma respuesta.
    const creado = await fetchVerificado(
      `${base}/instance/create`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: c.instancia, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
      },
      'No se pudo crear la instancia en tu servidor Evolution API (tiempo de espera agotado).',
    );
    if (!creado.ok) throw new BadRequestException(`Evolution API respondió ${creado.status} al crear la instancia. Revisa la API key.`);
    const body = (await creado.json()) as { qrcode?: { base64?: string } };
    if (!body.qrcode?.base64) throw new BadRequestException('Evolution API no devolvió un código QR. Intenta de nuevo.');
    return { estado: 'PENDIENTE', etiqueta: c.instancia, qrCode: body.qrcode.base64 };
  }

  if (!estadoRes.ok) throw new BadRequestException(`Evolution API respondió ${estadoRes.status}. Revisa la API key y el nombre de la instancia.`);

  const estadoBody = (await estadoRes.json()) as { instance?: { state?: string } };
  if (estadoBody.instance?.state === 'open') {
    const numero = await numeroConectado(base, c.evolutionApiKey, c.instancia);
    return { estado: 'CONECTADO', etiqueta: numero ?? c.instancia };
  }

  // La instancia existe pero no está emparejada (o se desconectó): pedimos un QR fresco.
  const qrRes = await fetchVerificado(
    `${base}/instance/connect/${encodeURIComponent(c.instancia)}`,
    { headers },
    'No se pudo obtener el código QR de tu servidor Evolution API (tiempo de espera agotado).',
  );
  if (!qrRes.ok) throw new BadRequestException(`Evolution API respondió ${qrRes.status} al pedir el código QR.`);
  const qrBody = (await qrRes.json()) as { base64?: string };
  if (!qrBody.base64) throw new BadRequestException('Evolution API no devolvió un código QR nuevo. Puede que ya esté conectada — vuelve a intentar en unos segundos.');
  return { estado: 'PENDIENTE', etiqueta: c.instancia, qrCode: qrBody.base64 };
}

/** Re-consulta el estado real en Evolution API (para el polling del frontend mientras se
 * muestra el QR). Nunca lanza — el polling debe poder seguir intentando ante fallos de red. */
export async function reconsultarWhatsappQr(c: CredencialesWhatsappQrResueltas): Promise<{ estado: 'CONECTADO' | 'PENDIENTE' | 'ERROR'; etiqueta: string }> {
  const base = c.evolutionApiUrl.replace(/\/+$/, '');
  try {
    const res = await fetchVerificado(
      `${base}/instance/connectionState/${encodeURIComponent(c.instancia)}`,
      { headers: { apikey: c.evolutionApiKey } },
      'timeout',
    );
    if (!res.ok) return { estado: 'ERROR', etiqueta: c.instancia };
    const body = (await res.json()) as { instance?: { state?: string } };
    if (body.instance?.state === 'open') {
      const numero = await numeroConectado(base, c.evolutionApiKey, c.instancia);
      return { estado: 'CONECTADO', etiqueta: numero ?? c.instancia };
    }
    return { estado: 'PENDIENTE', etiqueta: c.instancia };
  } catch {
    return { estado: 'ERROR', etiqueta: c.instancia };
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
