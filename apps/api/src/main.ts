import './load-env';
import 'reflect-metadata';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './common/uploads';
import { ZodExceptionFilter } from './common/zod-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Caddy hace de reverse proxy con terminación TLS (ver infra/Caddyfile) — sin esto, Express
  // no le cree a X-Forwarded-Proto y req.protocol siempre da "http", aunque el visitante real
  // haya entrado por https. Rompe cualquier URL absoluta que arme el backend a partir de la
  // request (ej. el callback de webhook de Meta, que exige https a la fuerza). "1" = confiar
  // en un solo salto de proxy delante (Caddy es el único).
  app.set('trust proxy', 1);
  app.disable('x-powered-by'); // no anunciar "Express" en cada respuesta
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ZodExceptionFilter());
  // Cabeceras de seguridad mínimas (sin dependencias). HSTS solo cuando se sirve por HTTPS.
  app.use((req: import('express').Request, res: import('express').Response, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  // Archivos subidos — servidos directo por Express, sin pasar por un controlador. Prefijo
  // /api/uploads (no /uploads): Caddy solo reenvía /api/* a este
  // contenedor (ver infra/Caddyfile), así que sin el prefijo el navegador nunca llegaría
  // aquí. El volumen Docker que persiste UPLOADS_DIR vive en docker-compose.yml.
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/api/uploads' });
  // La validación de entrada se hace con zod en cada controlador (packages/shared).
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true });
  // El límite por defecto de Express (100kb) se queda corto para audios/imágenes en base64
  // del módulo de Mensajes (notas de voz, stickers, fotos).
  // El cuerpo crudo (rawBody) se conserva para validar la firma X-Hub-Signature-256 de los webhooks de Meta:
  // el HMAC se calcula sobre los bytes exactos recibidos, no sobre el JSON ya parseado.
  app.use(json({ limit: '20mb', verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; } }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${port}/api`);
}
bootstrap();
