/**
 * Cifrado en reposo de las credenciales de los canales (tokens de Meta, API key de Evolution…).
 *
 * Algoritmo: AES-256-GCM (confidencialidad + integridad autenticada).
 * La clave maestra viene de ENCRYPTION_KEY (64 hex = 32 bytes) — la genera el instalador.
 * Si se pierde o se cambia, las integraciones ya conectadas dejan de poder descifrarse y hay
 * que volver a conectarlas.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM

export interface Cifrado {
  data: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export function masterKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('ENCRYPTION_KEY debe ser 64 caracteres hex (32 bytes). Genera con: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

export function cifrar(plano: Buffer): Cifrado {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const data = Buffer.concat([cipher.update(plano), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { data, iv, tag };
}

export function descifrar(c: Cifrado): Buffer {
  const decipher = createDecipheriv(ALGORITHM, masterKey(), c.iv);
  decipher.setAuthTag(c.tag);
  return Buffer.concat([decipher.update(c.data), decipher.final()]);
}

export const cifrarTexto = (texto: string): Cifrado => cifrar(Buffer.from(texto, 'utf8'));
export const descifrarTexto = (c: Cifrado): string => descifrar(c).toString('utf8');
