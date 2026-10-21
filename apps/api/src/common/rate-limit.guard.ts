import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

interface Limite { max: number; ventanaMs: number }

export const RATE_LIMIT_KEY = 'rate-limit';
/** Limita las peticiones por IP a un endpoint. Pensado para rutas sin sesión (login, formulario
 * público) donde no hay otra forma de frenar fuerza bruta o spam. Ej: `@RateLimit({ max: 10, ventanaMs: 60_000 })`. */
export const RateLimit = (limite: Limite) => SetMetadata(RATE_LIMIT_KEY, limite);

/** Ventana deslizante en memoria. Suficiente para una instalación de un solo proceso (una
 * empresa por servidor); si algún día se corre en varias réplicas habría que moverlo a Redis.
 * Clave = IP + ruta, así el límite de login no gasta el del formulario ni viceversa. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly accesos = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const limite = this.reflector.getAllAndOverride<Limite | undefined>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);
    if (!limite) return true;

    const req = context.switchToHttp().getRequest<Request>();
    // req.ip respeta X-Forwarded-For porque main.ts activa 'trust proxy' (Caddy delante).
    const clave = `${req.ip ?? 'desconocida'}:${req.method}:${req.route?.path ?? req.path}`;
    const ahora = Date.now();
    const desde = ahora - limite.ventanaMs;

    const recientes = (this.accesos.get(clave) ?? []).filter((t) => t > desde);
    if (recientes.length >= limite.max) {
      const esperaS = Math.ceil((recientes[0] + limite.ventanaMs - ahora) / 1000);
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Demasiados intentos. Espera ${esperaS}s e inténtalo de nuevo.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recientes.push(ahora);
    this.accesos.set(clave, recientes);
    this.limpiarSiHaceFalta(ahora);
    return true;
  }

  /** Purga ocasional de claves viejas para que el Map no crezca sin fin (cada ~5 min de reloj). */
  private ultimaLimpieza = 0;
  private limpiarSiHaceFalta(ahora: number) {
    if (ahora - this.ultimaLimpieza < 300_000) return;
    this.ultimaLimpieza = ahora;
    const maxVentana = 3_600_000;
    for (const [clave, tiempos] of this.accesos) {
      if (tiempos.every((t) => t < ahora - maxVentana)) this.accesos.delete(clave);
    }
  }
}
