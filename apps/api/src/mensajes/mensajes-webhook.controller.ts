import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MensajesService } from './mensajes.service';

/** Sin guards de auth a propósito: Meta no manda un JWT, manda el evento tal cual. La
 * validación es el `secret` en la propia URL y además la firma X-Hub-Signature-256 cuando la
 * integración tiene su App Secret (ver common/webhook-url.ts). Es la única ruta del CRM que
 * tiene que ser alcanzable desde internet. */
@Controller('mensajes/webhook')
export class MensajesWebhookController {
  constructor(private readonly mensajes: MensajesService) {}

  /** Meta llama esto UNA vez, al pegar la URL en su dashboard — hay que devolver el
   * `hub.challenge` tal cual (texto plano, no JSON) para confirmar que la URL es nuestra. */
  @Get('meta/:organizationId/:secret')
  async verificarMeta(
    @Param('organizationId') organizationId: string,
    @Param('secret') secret: string,
    @Query('hub.mode') modo: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const ok = await this.mensajes.verificarWebhookMeta(organizationId, secret, modo, verifyToken);
    // text/plain y String(): el challenge se devuelve tal cual, así que como HTML sería un XSS reflejado.
    if (ok) res.status(200).type('text/plain').send(String(challenge ?? ''));
    else res.status(403).send('Forbidden');
  }

  @Post('meta/:organizationId/:secret')
  @HttpCode(200)
  recibirMeta(
    @Param('organizationId') organizationId: string,
    @Param('secret') secret: string,
    @Headers('x-hub-signature-256') firma: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: unknown,
  ) {
    return this.mensajes.procesarWebhookMeta(organizationId, secret, body, { rawBody: req.rawBody, firma });
  }
}
