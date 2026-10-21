import { BadRequestException } from '@nestjs/common';

const API_URL = 'https://api.openai.com/v1/chat/completions';

function apiKeyOrThrow(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new BadRequestException('La interpretación con IA no está configurada en este servidor (falta OPENAI_API_KEY).');
  }
  return apiKey;
}

/** Llamada genérica a Chat Completions con Structured Outputs (json_schema) — transporte
 *  compartido por todos los usos de IA de un solo turno (mapeo de columnas, recomendaciones de
 *  cartera, resumen ejecutivo de gerencia). Cada llamador valida la forma de la respuesta a su
 *  manera antes de confiar en ella. */
export async function llamarChatJSON(params: {
  system: string;
  user: string;
  schemaName: string;
  schema: object;
  timeoutMs: number;
}): Promise<Record<string, unknown>> {
  const apiKey = apiKeyOrThrow();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: params.schemaName, schema: params.schema, strict: true } },
        temperature: 0,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new BadRequestException('No se pudo contactar el servicio de IA (tiempo de espera agotado).');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new BadRequestException(`El servicio de IA respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const contenido = body?.choices?.[0]?.message?.content;
  if (!contenido) throw new BadRequestException('El servicio de IA no devolvió una respuesta utilizable.');

  try {
    return JSON.parse(contenido);
  } catch {
    throw new BadRequestException('El servicio de IA devolvió un formato inesperado.');
  }
}

export interface HerramientaChatIA {
  name: string;
  description: string;
  parameters: object;
}

interface MensajeChatIA {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/** Chat multi-turno con function-calling: el modelo puede pedir ejecutar alguna de las
 *  `tools` provistas; cada pedido se resuelve vía `ejecutarHerramienta` (que decide el
 *  llamador — típicamente contra datos ya agregados y filtrados por organización, nunca
 *  contra la base de datos libremente) y el resultado se le devuelve al modelo hasta que
 *  responda con texto final. Corta a `maxIteraciones` para no encadenar llamadas sin fin. */
export async function llamarChatConHerramientas(params: {
  system: string;
  historial: { role: 'user' | 'assistant'; content: string }[];
  tools: HerramientaChatIA[];
  ejecutarHerramienta: (nombre: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  timeoutMs: number;
  maxIteraciones?: number;
}): Promise<{ respuesta: string; herramientasUsadas: { nombre: string; args: Record<string, unknown> }[] }> {
  const apiKey = apiKeyOrThrow();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxIteraciones = params.maxIteraciones ?? 4;

  const messages: MensajeChatIA[] = [
    { role: 'system', content: params.system },
    ...params.historial.map((m) => ({ role: m.role, content: m.content })),
  ];
  const herramientasUsadas: { nombre: string; args: Record<string, unknown> }[] = [];

  for (let iteracion = 0; iteracion < maxIteraciones; iteracion++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs);
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          tools: params.tools.map((t) => ({ type: 'function', function: t })),
          tool_choice: 'auto',
          temperature: 0,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new BadRequestException('No se pudo contactar el servicio de IA (tiempo de espera agotado).');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new BadRequestException(`El servicio de IA respondió ${res.status}: ${detalle.slice(0, 300)}`);
    }

    const body = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null; tool_calls?: MensajeChatIA['tool_calls'] } }[];
    } | null;
    const mensaje = body?.choices?.[0]?.message;
    if (!mensaje) throw new BadRequestException('El servicio de IA no devolvió una respuesta utilizable.');

    if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
      const contenido = mensaje.content?.trim();
      if (!contenido) throw new BadRequestException('El servicio de IA no devolvió una respuesta utilizable.');
      return { respuesta: contenido, herramientasUsadas };
    }

    messages.push({ role: 'assistant', content: mensaje.content ?? '', tool_calls: mensaje.tool_calls });
    for (const llamada of mensaje.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(llamada.function.arguments || '{}');
      } catch {
        // argumentos inválidos: se le pasa vacío a la herramienta, que decide qué hacer
      }
      herramientasUsadas.push({ nombre: llamada.function.name, args });
      const resultado = await params.ejecutarHerramienta(llamada.function.name, args);
      messages.push({ role: 'tool', tool_call_id: llamada.id, content: JSON.stringify(resultado) });
    }
  }

  throw new BadRequestException('El asistente no pudo resolver la consulta (demasiados pasos). Intenta reformular la pregunta.');
}
