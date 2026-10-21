import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError, type ZodIssue } from 'zod';

/** Sin esto, cualquier `schema.parse(body)` que falle (en CUALQUIER controlador — todos usan
 *  este mismo patrón) tira un ZodError sin capturar, que Nest convierte en un 500 genérico
 *  ("Internal server error") en vez de un 400 con el motivo real. El cliente (web o móvil)
 *  se queda sin saber qué campo estaba mal. */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const mensaje = exception.issues
      .map((i: ZodIssue) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join(', ');
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: mensaje || 'Datos inválidos',
    });
  }
}
