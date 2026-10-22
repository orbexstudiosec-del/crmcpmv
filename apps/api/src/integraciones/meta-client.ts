import { BadRequestException } from '@nestjs/common';
import type { CredencialesWhatsappApi } from '@totalcrm/shared';

const GRAPH = 'https://graph.facebook.com/v20.0';
const TIMEOUT_MS = 10_000;

async function llamar(c: CredencialesWhatsappApi, body: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${GRAPH}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    });
  } catch {
    throw new BadRequestException('No se pudo contactar la API de Meta (tiempo de espera agotado).');
  } finally {
    clearTimeout(timer);
  }
}

async function lanzarSiFalla(res: Response, accion: string): Promise<void> {
  if (res.ok) return;
  const detalle = await res.text().catch(() => '');
  throw new BadRequestException(`Meta Graph API respondió ${res.status} al ${accion}: ${detalle.slice(0, 300)}`);
}

interface RespuestaMeta { messages?: { id?: string }[] }

/** Texto plano vía WhatsApp Business Platform (Meta Cloud API, oficial y documentada). */
export async function enviarTextoMeta(c: CredencialesWhatsappApi, numero: string, texto: string): Promise<{ remoteId?: string }> {
  const res = await llamar(c, { to: numero, type: 'text', text: { body: texto } });
  await lanzarSiFalla(res, 'enviar el mensaje');
  const body = (await res.json().catch(() => ({}))) as RespuestaMeta;
  return { remoteId: body.messages?.[0]?.id };
}

/** Mensaje de plantilla pre-aprobada (Meta exige esto para escribirle primero a un contacto
 * nuevo fuera de la ventana de 24h — un texto libre sería rechazado). `plantilla` debe
 * coincidir EXACTO con el nombre de una plantilla ya aprobada en Meta Business Manager;
 * `parametros` se mapean en orden al único componente "body" de la plantilla. */
export async function enviarPlantillaMeta(
  c: CredencialesWhatsappApi, numero: string, plantilla: string, idioma: string, parametros: string[],
): Promise<{ remoteId?: string }> {
  const res = await llamar(c, {
    to: numero,
    type: 'template',
    template: {
      name: plantilla,
      language: { code: idioma },
      components: parametros.length ? [{ type: 'body', parameters: parametros.map((p) => ({ type: 'text', text: p })) }] : undefined,
    },
  });
  await lanzarSiFalla(res, 'enviar la plantilla');
  const body = (await res.json().catch(() => ({}))) as RespuestaMeta;
  return { remoteId: body.messages?.[0]?.id };
}

/** Imagen por URL pública — Meta la descarga sola, no hace falta subir el binario primero. */
export async function enviarImagenMeta(c: CredencialesWhatsappApi, numero: string, url: string, caption?: string): Promise<{ remoteId?: string }> {
  const res = await llamar(c, { to: numero, type: 'image', image: { link: url, caption } });
  await lanzarSiFalla(res, 'enviar la imagen');
  const body = (await res.json().catch(() => ({}))) as RespuestaMeta;
  return { remoteId: body.messages?.[0]?.id };
}

/** Documento por URL pública, igual que la imagen. */
export async function enviarDocumentoMeta(
  c: CredencialesWhatsappApi, numero: string, url: string, filename?: string, caption?: string,
): Promise<{ remoteId?: string }> {
  const res = await llamar(c, { to: numero, type: 'document', document: { link: url, filename, caption } });
  await lanzarSiFalla(res, 'enviar el documento');
  const body = (await res.json().catch(() => ({}))) as RespuestaMeta;
  return { remoteId: body.messages?.[0]?.id };
}

/** Suscribe la WABA a los eventos de la app (mensajes entrantes, cambios de estado) — sin
 * esto, aunque el callback URL esté bien configurado en Meta for Developers, Meta nunca
 * empieza a mandarle eventos de ESTA cuenta específica. Meta NO permite registrar la URL del webhook por API (eso es manual, en el dashboard de la app) —
 * esto solo cubre la mitad automatizable. Best-effort: si falla, no rompe la conexión, el
 * envío de mensajes sigue funcionando igual, solo no llegarán entrantes hasta resolverlo. */
export async function suscribirWebhookMeta(c: CredencialesWhatsappApi): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GRAPH}/${c.wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      return `Meta Graph API respondió ${res.status} al suscribir el webhook: ${detalle.slice(0, 300)}`;
    }
    return null;
  } catch (err) {
    return err instanceof Error && err.name === 'AbortError'
      ? 'Tiempo de espera agotado al suscribir el webhook.'
      : 'No se pudo contactar la API de Meta para suscribir el webhook.';
  } finally {
    clearTimeout(timer);
  }
}

/** Botones/lista interactivos REALES de WhatsApp (feature oficial de Meta). Meta permite máximo 3 "reply buttons" tocables — con
 * más opciones usa el formato "list" (hasta 10 filas), que es el propio mecanismo de Meta
 * para menús largos, no una degradación. */
export async function enviarBotonesMeta(
  c: CredencialesWhatsappApi, numero: string, texto: string, opciones: { id: string; title: string }[],
): Promise<{ remoteId?: string }> {
  const interactive = opciones.length <= 3
    ? {
        type: 'button',
        body: { text: texto },
        action: { buttons: opciones.map((o) => ({ type: 'reply', reply: { id: o.id, title: o.title.slice(0, 20) } })) },
      }
    : {
        type: 'list',
        body: { text: texto },
        action: {
          button: 'Ver opciones',
          sections: [{ title: 'Opciones', rows: opciones.slice(0, 10).map((o) => ({ id: o.id, title: o.title.slice(0, 24) })) }],
        },
      };
  const res = await llamar(c, { to: numero, type: 'interactive', interactive });
  await lanzarSiFalla(res, 'enviar las opciones');
  const body = (await res.json().catch(() => ({}))) as RespuestaMeta;
  return { remoteId: body.messages?.[0]?.id };
}
