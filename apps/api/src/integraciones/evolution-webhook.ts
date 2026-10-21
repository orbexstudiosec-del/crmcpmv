import type { CredencialesWhatsappQrResueltas } from '@totalcrm/shared';

const TIMEOUT_MS = 10_000;

/** Registra el webhook de Evolution API para esta instancia (evento `messages.upsert`),
 * apuntando al receptor del CRM — así la recepción queda configurada automáticamente,
 * sin que el usuario tenga que pegar nada a mano en Evolution Manager.
 *
 * Best-effort: si falla (versión de Evolution con otro contrato, servidor caído, etc.) NO
 * rompe la conexión — el emparejamiento QR y el envío de mensajes siguen funcionando igual.
 * Devuelve `null` si quedó configurado, o un mensaje de error legible si no. */
export async function configurarWebhookEvolution(c: CredencialesWhatsappQrResueltas, webhookUrl: string): Promise<string | null> {
  const base = c.evolutionApiUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/webhook/set/${encodeURIComponent(c.instancia)}`, {
      method: 'POST',
      headers: { apikey: c.evolutionApiKey, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        webhook: { url: webhookUrl, enabled: true, events: ['MESSAGES_UPSERT'] },
      }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      return `Evolution API respondió ${res.status} al configurar el webhook: ${detalle.slice(0, 300)}`;
    }
    return null;
  } catch (err) {
    return err instanceof Error && err.name === 'AbortError'
      ? 'Tiempo de espera agotado al configurar el webhook automático.'
      : 'No se pudo contactar tu servidor Evolution API para configurar el webhook automático.';
  } finally {
    clearTimeout(timer);
  }
}
