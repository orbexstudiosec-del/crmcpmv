import { createHmac, timingSafeEqual } from 'node:crypto';
import { masterKey } from './cifrado';

/** Secreto de la URL del webhook, derivado del organizationId con la misma clave maestra
 * que cifra las credenciales. No se guarda en BD: se recalcula cada vez, así que es estable
 * sin necesitar una columna extra. Vive en `common` (no en `mensajes` ni en `integraciones`)
 * porque ambos módulos la necesitan: `integraciones` para mostrar la URL al conectar,
 * `mensajes` para validar lo que llega. */
export function webhookSecret(organizationId: string): string {
  return createHmac('sha256', masterKey()).update(organizationId).digest('hex').slice(0, 32);
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function webhookSecretValido(organizationId: string, recibido: string): boolean {
  return igualesEnTiempoConstante(recibido, webhookSecret(organizationId));
}

/** Valida la cabecera `X-Hub-Signature-256` que Meta manda en cada evento: HMAC-SHA256 del
 * cuerpo crudo con el App Secret de la app de Meta. Es lo que prueba que el evento viene de
 * Meta y no de alguien que conoce la URL. */
export function firmaMetaValida(rawBody: Buffer | undefined, cabecera: string | undefined, appSecret: string): boolean {
  if (!rawBody || !cabecera?.startsWith('sha256=')) return false;
  const esperada = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return igualesEnTiempoConstante(cabecera, esperada);
}

/** Meta no tiene un endpoint para registrar este callback por API:
 * el usuario tiene que pegar esta URL a mano en Meta for Developers → su app → WhatsApp →
 * Configuración → Webhook (ver integraciones.service.ts#conectar). */
export function urlWebhookMeta(organizationId: string, origen: string): string {
  return `${origen}/api/mensajes/webhook/meta/${organizationId}/${webhookSecret(organizationId)}`;
}
