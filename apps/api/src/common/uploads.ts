import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

/** Carpeta raíz de archivos subidos por usuarios (fotos de visitas, por ahora). Montada como
 * volumen Docker (ver docker-compose.yml) para sobrevivir a un rebuild del contenedor api —
 * sin eso, cada `docker compose build api` borraría todas las fotos. */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

const MIME_A_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — margen sobre una foto de celular típica

/** Decodifica una foto en base64 (con o sin prefijo "data:<mime>;base64,") y la guarda en
 * `UPLOADS_DIR/<carpeta>/<organizationId>/<uuid>.<ext>`. Devuelve la URL pública relativa
 * bajo /api/uploads (ver main.ts) para guardar en la fila de BD. */
export async function guardarFotoBase64(carpeta: string, organizationId: string, dataBase64: string): Promise<string> {
  const match = dataBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  const mime = match?.[1] ?? 'image/jpeg';
  const contenido = match?.[2] ?? dataBase64;
  const ext = MIME_A_EXT[mime] ?? 'jpg';

  const buffer = Buffer.from(contenido, 'base64');
  if (buffer.length === 0) throw new BadRequestException('La foto está vacía o no es un base64 válido');
  if (buffer.length > MAX_BYTES) throw new BadRequestException('La foto supera el tamaño máximo permitido (15MB)');

  const dir = join(UPLOADS_DIR, carpeta, organizationId);
  await mkdir(dir, { recursive: true });
  const nombre = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, nombre), buffer);

  return `/api/uploads/${carpeta}/${organizationId}/${nombre}`;
}
