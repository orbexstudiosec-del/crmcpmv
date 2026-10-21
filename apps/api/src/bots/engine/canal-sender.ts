import type { CanalMensajeria, CredencialesWhatsappQrResueltas, CredencialesWhatsappApi } from '@totalcrm/shared';
import { IntegracionesService } from '../../integraciones/integraciones.service';
import { enviarWhatsappQr, enviarListaWhatsappQr, enviarArchivoWhatsappQr } from '../../mensajes/evolution-client';
import { enviarTextoMeta, enviarBotonesMeta, enviarImagenMeta, enviarDocumentoMeta } from '../../integraciones/meta-client';
import { descargarUrlExterna } from '../../common/ssrf';

const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // tope de WhatsApp para imágenes/documentos enviados por el bot

/** Capa única de envío que usa el motor de bots: resuelve credenciales por canal y despacha
 * a Evolution API (WHATSAPP_QR) o Meta Graph API (WHATSAPP_API) — el resto del motor no
 * necesita saber cuál es cuál. Devuelve `null` (en vez de lanzar) si el canal no está
 * conectado, porque un envío fallido del bot nunca debe romper el procesamiento del mensaje
 * entrante que lo disparó. */

async function credenciales(integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria) {
  return integraciones.credencialesDescifradas(organizationId, canal);
}

export async function enviarTexto(
  integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria, numero: string, texto: string,
): Promise<{ remoteId?: string } | null> {
  const cred = await credenciales(integraciones, organizationId, canal);
  if (!cred) return null;
  try {
    if (canal === 'WHATSAPP_QR') return await enviarWhatsappQr(cred as CredencialesWhatsappQrResueltas, numero, texto);
    if (canal === 'WHATSAPP_API') return await enviarTextoMeta(cred as CredencialesWhatsappApi, numero, texto);
    return null;
  } catch {
    return null;
  }
}

/** Botones/lista de opciones. Por WhatsApp QR intenta la lista nativa de Evolution primero y
 * cae a texto numerado si falla (endpoint no verificado); por WhatsApp Business API usa los
 * botones/lista reales de Meta (oficiales, sin necesidad de fallback). */
export async function enviarOpciones(
  integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria,
  numero: string, texto: string, opciones: { id: string; title: string }[],
): Promise<{ remoteId?: string } | null> {
  const cred = await credenciales(integraciones, organizationId, canal);
  if (!cred) return null;
  const textoNumerado = `${texto}\n\n${opciones.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`;
  try {
    if (canal === 'WHATSAPP_QR') {
      const c = cred as CredencialesWhatsappQrResueltas;
      try {
        return await enviarListaWhatsappQr(c, numero, { texto, tituloBoton: 'Ver opciones', opciones });
      } catch {
        return await enviarWhatsappQr(c, numero, textoNumerado);
      }
    }
    if (canal === 'WHATSAPP_API') return await enviarBotonesMeta(cred as CredencialesWhatsappApi, numero, texto, opciones);
    return null;
  } catch {
    return null;
  }
}

export async function enviarMedia(
  integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria, numero: string,
  kind: 'image' | 'document', url: string, filename?: string, caption?: string,
): Promise<{ remoteId?: string } | null> {
  const cred = await credenciales(integraciones, organizationId, canal);
  if (!cred) return null;
  try {
    if (canal === 'WHATSAPP_QR') {
      const c = cred as CredencialesWhatsappQrResueltas;
      // La URL la escribe quien arma el bot: sin validarla, el servidor descargaría direcciones
      // internas (metadata de la nube, la base de datos…) y se las mandaría al contacto (SSRF).
      const { buffer, contentType } = await descargarUrlExterna(url, { maxBytes: MAX_MEDIA_BYTES, timeoutMs: 20_000 });
      const mimetype = contentType ?? (kind === 'image' ? 'image/jpeg' : 'application/octet-stream');
      return await enviarArchivoWhatsappQr(c, numero, { mediatype: kind, mimetype, media: buffer.toString('base64'), fileName: filename, caption });
    }
    if (canal === 'WHATSAPP_API') {
      const c = cred as CredencialesWhatsappApi;
      return kind === 'image' ? await enviarImagenMeta(c, numero, url, caption) : await enviarDocumentoMeta(c, numero, url, filename, caption);
    }
    return null;
  } catch {
    return null;
  }
}
