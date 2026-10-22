import type { CanalMensajeria, CredencialesWhatsappApi } from '@totalcrm/shared';
import { IntegracionesService } from '../../integraciones/integraciones.service';
import { enviarTextoMeta, enviarBotonesMeta, enviarImagenMeta, enviarDocumentoMeta } from '../../integraciones/meta-client';

/** Capa única de envío que usa el motor de bots: resuelve las credenciales del canal y
 * despacha a Meta Graph API (WhatsApp Business, único canal de envío autorizado). Devuelve
 * `null` (en vez de lanzar) si el canal no está conectado, porque un envío fallido del bot
 * nunca debe romper el procesamiento del mensaje entrante que lo disparó. */

async function credencialesWhatsapp(integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria) {
  if (canal !== 'WHATSAPP_API') return null;
  return (await integraciones.credencialesDescifradas(organizationId, canal)) as CredencialesWhatsappApi | null;
}

export async function enviarTexto(
  integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria, numero: string, texto: string,
): Promise<{ remoteId?: string } | null> {
  const cred = await credencialesWhatsapp(integraciones, organizationId, canal);
  if (!cred) return null;
  try {
    return await enviarTextoMeta(cred, numero, texto);
  } catch {
    return null;
  }
}

/** Botones/lista de opciones con los botones y listas reales de Meta. */
export async function enviarOpciones(
  integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria,
  numero: string, texto: string, opciones: { id: string; title: string }[],
): Promise<{ remoteId?: string } | null> {
  const cred = await credencialesWhatsapp(integraciones, organizationId, canal);
  if (!cred) return null;
  try {
    return await enviarBotonesMeta(cred, numero, texto, opciones);
  } catch {
    return null;
  }
}

/** Imagen o documento por URL: Meta descarga el archivo directamente desde esa URL (tiene que
 * ser pública con HTTPS), así que el servidor del CRM nunca la abre. */
export async function enviarMedia(
  integraciones: IntegracionesService, organizationId: string, canal: CanalMensajeria, numero: string,
  kind: 'image' | 'document', url: string, filename?: string, caption?: string,
): Promise<{ remoteId?: string } | null> {
  const cred = await credencialesWhatsapp(integraciones, organizationId, canal);
  if (!cred) return null;
  try {
    return kind === 'image' ? await enviarImagenMeta(cred, numero, url, caption) : await enviarDocumentoMeta(cred, numero, url, filename, caption);
  } catch {
    return null;
  }
}
