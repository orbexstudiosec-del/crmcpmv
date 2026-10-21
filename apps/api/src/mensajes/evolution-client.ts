import { BadRequestException } from '@nestjs/common';
import type { CredencialesWhatsappQrResueltas } from '@totalcrm/shared';

const TIMEOUT_MS = 10_000;
const TIMEOUT_MEDIA_MS = 25_000; // subir/bajar archivos tarda más que un texto

async function llamar(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new BadRequestException('No se pudo contactar tu servidor Evolution API (tiempo de espera agotado).');
  } finally {
    clearTimeout(timer);
  }
}

function headers(c: CredencialesWhatsappQrResueltas) {
  return { apikey: c.evolutionApiKey, 'Content-Type': 'application/json' };
}
function baseUrl(c: CredencialesWhatsappQrResueltas) {
  return c.evolutionApiUrl.replace(/\/+$/, '');
}
async function lanzarSiFalla(res: Response, accion: string): Promise<void> {
  if (res.ok) return;
  const detalle = await res.text().catch(() => '');
  throw new BadRequestException(`Evolution API respondió ${res.status} al ${accion}: ${detalle.slice(0, 300)}`);
}

/** Envía un mensaje de texto por WhatsApp vía Evolution API.
 * Contrato: `POST {base}/message/sendText/{instancia}` con `{ number, text }` — es el shape
 * estándar de Evolution API v2, pero puede variar levemente según la versión desplegada.
 * Si tu servidor devuelve otro formato, el mensaje de error de abajo muestra la respuesta
 * cruda para poder ajustarlo juntos en vez de fallar en silencio. */
export async function enviarWhatsappQr(c: CredencialesWhatsappQrResueltas, numero: string, texto: string): Promise<{ remoteId?: string }> {
  const res = await llamar(`${baseUrl(c)}/message/sendText/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({ number: numero, text: texto }),
  });
  await lanzarSiFalla(res, 'enviar el mensaje');
  const body = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
  return { remoteId: body.key?.id };
}

/** Nota de voz. Contrato: `POST {base}/message/sendWhatsAppAudio/{instancia}` con
 * `{ number, audio }` (base64 sin prefijo "data:..."). No verificado en vivo todavía —
 * el error de abajo muestra la respuesta cruda si el contrato de tu versión difiere. */
export async function enviarAudioWhatsappQr(c: CredencialesWhatsappQrResueltas, numero: string, audioBase64: string): Promise<{ remoteId?: string }> {
  const res = await llamar(`${baseUrl(c)}/message/sendWhatsAppAudio/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({ number: numero, audio: audioBase64 }),
  }, TIMEOUT_MEDIA_MS);
  await lanzarSiFalla(res, 'enviar la nota de voz');
  const body = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
  return { remoteId: body.key?.id };
}

/** Sticker. Contrato: `POST {base}/message/sendSticker/{instancia}` con `{ number, sticker }`
 * (base64 sin prefijo). No verificado en vivo. */
export async function enviarStickerWhatsappQr(c: CredencialesWhatsappQrResueltas, numero: string, stickerBase64: string): Promise<{ remoteId?: string }> {
  const res = await llamar(`${baseUrl(c)}/message/sendSticker/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({ number: numero, sticker: stickerBase64 }),
  }, TIMEOUT_MEDIA_MS);
  await lanzarSiFalla(res, 'enviar el sticker');
  const body = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
  return { remoteId: body.key?.id };
}

/** Imagen, video o documento. Contrato: `POST {base}/message/sendMedia/{instancia}` con
 * `{ number, mediatype, mimetype, media, fileName?, caption? }`. No verificado en vivo. */
export async function enviarArchivoWhatsappQr(
  c: CredencialesWhatsappQrResueltas, numero: string,
  params: { mediatype: 'image' | 'video' | 'document'; mimetype: string; media: string; fileName?: string; caption?: string },
): Promise<{ remoteId?: string }> {
  const res = await llamar(`${baseUrl(c)}/message/sendMedia/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({ number: numero, ...params }),
  }, TIMEOUT_MEDIA_MS);
  await lanzarSiFalla(res, 'enviar el archivo');
  const body = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
  return { remoteId: body.key?.id };
}

/** Lista interactiva nativa de WhatsApp (el equivalente a "botones" que sí soportan los
 * clientes no oficiales tipo Baileys/Evolution — Meta restringió los botones nativos ahí).
 * Contrato: `POST {base}/message/sendList/{instancia}` con
 * `{ number, title, description, buttonText, sections: [{ title, rows: [{title, rowId}] }] }`
 * — no verificado en vivo, puede variar según la versión de Evolution desplegada. Quien la
 * llama (el motor de bots) debe hacer fallback a texto plano si esta función lanza. */
export async function enviarListaWhatsappQr(
  c: CredencialesWhatsappQrResueltas, numero: string,
  params: { texto: string; tituloBoton: string; opciones: { id: string; title: string }[] },
): Promise<{ remoteId?: string }> {
  const res = await llamar(`${baseUrl(c)}/message/sendList/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({
      number: numero,
      title: params.texto,
      description: params.texto,
      buttonText: params.tituloBoton,
      sections: [{ title: 'Opciones', rows: params.opciones.map((o) => ({ title: o.title, rowId: o.id })) }],
    }),
  });
  await lanzarSiFalla(res, 'enviar la lista de opciones');
  const body = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
  return { remoteId: body.key?.id };
}

/** Foto de perfil del contacto. Contrato: `POST {base}/chat/fetchProfilePictureUrl/{instancia}`
 * con `{ number }` — no verificado en vivo; si tu versión de Evolution no expone este
 * endpoint o el contacto no tiene foto, simplemente no se muestra (no rompe el flujo). */
export async function obtenerFotoPerfilWhatsappQr(c: CredencialesWhatsappQrResueltas, numero: string): Promise<{ profilePictureUrl?: string }> {
  const res = await llamar(`${baseUrl(c)}/chat/fetchProfilePictureUrl/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({ number: numero }),
  });
  if (!res.ok) return {};
  return (await res.json().catch(() => ({}))) as { profilePictureUrl?: string };
}

/** Descarga y descifra un mensaje de media ya recibido (WhatsApp cifra los adjuntos: la URL
 * cruda del CDN no sirve sola, Evolution la descifra con la mediaKey del mensaje original).
 * Contrato: `POST {base}/chat/getBase64FromMediaMessage/{instancia}` con
 * `{ message: { key: { id, remoteJid, fromMe } } }` — confirmado en vivo contra un mensaje
 * real (falla si el enlace de WhatsApp ya expiró, algo normal en mensajes viejos). */
export async function obtenerMediaWhatsappQr(
  c: CredencialesWhatsappQrResueltas,
  key: { id: string; remoteJid: string; fromMe: boolean },
): Promise<{ base64: string; mimetype?: string }> {
  const res = await llamar(`${baseUrl(c)}/chat/getBase64FromMediaMessage/${encodeURIComponent(c.instancia)}`, {
    method: 'POST', headers: headers(c),
    body: JSON.stringify({ message: { key }, convertToMp4: false }),
  }, TIMEOUT_MEDIA_MS);
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new BadRequestException(`No se pudo cargar el archivo (puede que el enlace de WhatsApp ya haya expirado): ${detalle.slice(0, 200)}`);
  }
  const body = (await res.json()) as { base64?: string; mimetype?: string };
  if (!body.base64) throw new BadRequestException('Evolution API no devolvió el archivo.');
  return { base64: body.base64, mimetype: body.mimetype };
}
