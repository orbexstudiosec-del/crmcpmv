import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConfiguracionIaInput } from '@totalcrm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { cifrarTexto, descifrarTexto } from '../common/cifrado';
import { probarCredencialesIA, type CredencialesIA } from '../common/ai/openai-client';

const MODELO_POR_DEFECTO = 'gpt-4o-mini';
const MENSAJE_SIN_CONFIGURAR = 'La IA no está configurada. Un administrador puede cargar la API key de OpenAI en Configuración → Inteligencia artificial.';

/** "sk-proj-…AbCd": suficiente para reconocer qué clave está cargada sin exponerla. */
const enmascarar = (inicio: string, final: string) => `${inicio}…${final}`;

/** Estado visible de la configuración: nunca incluye la clave. */
export interface EstadoIA {
  /** Dónde está la clave que se usa: cargada en Configuración, la del servidor (.env) o ninguna. */
  origen: 'CRM' | 'SERVIDOR' | null;
  claveMascara: string | null;
  modelo: string;
}

@Injectable()
export class IaService {
  constructor(private readonly prisma: PrismaService) {}

  async estado(organizationId: string): Promise<EstadoIA> {
    const cfg = await this.prisma.configuracionIA.findUnique({ where: { organizationId } });
    if (cfg) {
      // Los 3 primeros caracteres se leen descifrando: no se guardan aparte para no dejar
      // fragmentos de la clave en claro más allá de los últimos 4.
      const clave = this.descifrar(cfg);
      return { origen: 'CRM', claveMascara: enmascarar(clave.slice(0, 3), cfg.apiKeyFinal), modelo: cfg.modelo };
    }
    const delServidor = process.env.OPENAI_API_KEY;
    if (delServidor) {
      return { origen: 'SERVIDOR', claveMascara: enmascarar(delServidor.slice(0, 3), delServidor.slice(-4)), modelo: process.env.OPENAI_MODEL || MODELO_POR_DEFECTO };
    }
    return { origen: null, claveMascara: null, modelo: MODELO_POR_DEFECTO };
  }

  /** Guarda la clave (o solo cambia el modelo). Antes de guardar la prueba contra OpenAI: así no
   *  queda cargada una clave que no funciona. */
  async guardar(organizationId: string, input: ConfiguracionIaInput): Promise<EstadoIA> {
    const actual = await this.prisma.configuracionIA.findUnique({ where: { organizationId } });
    const apiKey = input.apiKey ?? (actual ? this.descifrar(actual) : null);
    if (!apiKey) throw new BadRequestException('Falta la API key de OpenAI.');

    const prueba = await probarCredencialesIA({ apiKey, modelo: input.modelo });
    if (!prueba.ok) throw new BadRequestException(prueba.motivo);

    const cifrado = cifrarTexto(apiKey);
    const datos = {
      apiKeyCifrada: new Uint8Array(cifrado.data),
      apiKeyIv: new Uint8Array(cifrado.iv),
      apiKeyTag: new Uint8Array(cifrado.tag),
      apiKeyFinal: apiKey.slice(-4),
      modelo: input.modelo,
    };
    await this.prisma.configuracionIA.upsert({ where: { organizationId }, create: { organizationId, ...datos }, update: datos });
    return this.estado(organizationId);
  }

  /** Quita la clave cargada en el CRM (si el servidor tiene OPENAI_API_KEY, pasa a usarse esa). */
  async eliminar(organizationId: string): Promise<EstadoIA> {
    await this.prisma.configuracionIA.deleteMany({ where: { organizationId } });
    return this.estado(organizationId);
  }

  async probar(organizationId: string) {
    const credenciales = await this.credenciales(organizationId);
    const prueba = await probarCredencialesIA(credenciales);
    if (!prueba.ok) throw new BadRequestException(prueba.motivo);
    return { ok: true, modelo: credenciales.modelo };
  }

  /** Credenciales para llamar a la IA: primero las de Configuración, si no las del servidor. */
  async credenciales(organizationId: string): Promise<CredencialesIA> {
    const cfg = await this.prisma.configuracionIA.findUnique({ where: { organizationId } });
    if (cfg) return { apiKey: this.descifrar(cfg), modelo: cfg.modelo };
    if (process.env.OPENAI_API_KEY) return { apiKey: process.env.OPENAI_API_KEY, modelo: process.env.OPENAI_MODEL || MODELO_POR_DEFECTO };
    throw new BadRequestException(MENSAJE_SIN_CONFIGURAR);
  }

  private descifrar(cfg: { apiKeyCifrada: Uint8Array; apiKeyIv: Uint8Array; apiKeyTag: Uint8Array }): string {
    return descifrarTexto({ data: Buffer.from(cfg.apiKeyCifrada), iv: Buffer.from(cfg.apiKeyIv), tag: Buffer.from(cfg.apiKeyTag) });
  }
}
