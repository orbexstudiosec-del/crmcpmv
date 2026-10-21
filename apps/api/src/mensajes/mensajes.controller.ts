import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MensajesService } from './mensajes.service';
import {
  enviarMensajeSchema, iniciarConversacionSchema, enviarAudioSchema, enviarStickerSchema, enviarArchivoSchema,
  vincularClienteConversacionSchema, actualizarEtapaConversacionSchema, vincularLeadConversacionSchema,
  actualizarEstadoConversacionSchema, asignarConversacionSchema, notaConversacionSchema, crearLeadConversacionSchema,
  pausarBotConversacionSchema,
} from '@totalcrm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenancyGuard } from '../auth/guards/tenancy.guard';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/auth.service';

@Controller('mensajes')
@UseGuards(JwtAuthGuard, TenancyGuard, RolesGuard)
// Las conversaciones con los socios son del personal de atención; riesgos y gerencia no las ven
// (la web tampoco les muestra Mensajes).
@Roles('OWNER', 'ADMIN', 'SUPERVISOR', 'AGENTE')
export class MensajesController {
  constructor(private readonly mensajes: MensajesService) {}

  @Get('conversaciones')
  listar(@OrgId() orgId: string) {
    return this.mensajes.listarConversaciones(orgId);
  }

  @Get('conversaciones/:id')
  obtener(@OrgId() orgId: string, @Param('id') id: string) {
    return this.mensajes.obtenerConversacion(orgId, id);
  }

  @Post('conversaciones')
  iniciar(@OrgId() orgId: string, @Body() body: unknown) {
    const { numero, canal } = iniciarConversacionSchema.parse(body);
    return this.mensajes.iniciarConversacion(orgId, numero, canal ?? 'WHATSAPP_QR');
  }

  @Delete('conversaciones/:id')
  eliminarConversacion(@OrgId() orgId: string, @Param('id') id: string) {
    return this.mensajes.eliminarConversacion(orgId, id);
  }

  @Patch('conversaciones/:id/cliente')
  vincularCliente(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { clienteId } = vincularClienteConversacionSchema.parse(body);
    return this.mensajes.vincularCliente(orgId, id, clienteId);
  }

  @Patch('conversaciones/:id/etapa')
  actualizarEtapa(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { etapa } = actualizarEtapaConversacionSchema.parse(body);
    return this.mensajes.actualizarEtapaPipeline(orgId, id, etapa);
  }

  @Patch('conversaciones/:id/lead')
  vincularLead(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { leadId } = vincularLeadConversacionSchema.parse(body);
    return this.mensajes.vincularLead(orgId, id, leadId);
  }

  @Post('conversaciones/:id/lead')
  crearLead(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { nombre } = crearLeadConversacionSchema.parse(body ?? {});
    return this.mensajes.crearLeadDesdeConversacion(orgId, id, nombre);
  }

  @Patch('conversaciones/:id/estado')
  actualizarEstado(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { estado } = actualizarEstadoConversacionSchema.parse(body);
    return this.mensajes.actualizarEstado(orgId, id, estado);
  }

  @Patch('conversaciones/:id/asignado')
  asignar(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { membershipId } = asignarConversacionSchema.parse(body);
    return this.mensajes.asignar(orgId, id, membershipId);
  }

  @Patch('conversaciones/:id/bot')
  pausarBot(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { pausado } = pausarBotConversacionSchema.parse(body);
    return this.mensajes.pausarBot(orgId, id, pausado);
  }

  @Post('conversaciones/:id/notas')
  agregarNota(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser() usuario: JwtPayload, @Body() body: unknown) {
    const { contenido } = notaConversacionSchema.parse(body);
    return this.mensajes.agregarNota(orgId, id, usuario.sub, contenido);
  }

  @Post('conversaciones/:id/mensajes')
  enviar(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { contenido } = enviarMensajeSchema.parse(body);
    return this.mensajes.enviarMensaje(orgId, id, contenido);
  }

  @Post('conversaciones/:id/audio')
  enviarAudio(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { contenido } = enviarAudioSchema.parse(body);
    return this.mensajes.enviarAudio(orgId, id, contenido);
  }

  @Post('conversaciones/:id/sticker')
  enviarSticker(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const { contenido } = enviarStickerSchema.parse(body);
    return this.mensajes.enviarSticker(orgId, id, contenido);
  }

  @Post('conversaciones/:id/archivo')
  enviarArchivo(@OrgId() orgId: string, @Param('id') id: string, @Body() body: unknown) {
    const datos = enviarArchivoSchema.parse(body);
    return this.mensajes.enviarArchivo(orgId, id, { contenido: datos.contenido, mimetype: datos.mimetype, nombreArchivo: datos.nombreArchivo, caption: datos.caption });
  }

  @Get('conversaciones/:id/mensajes/:mensajeId/media')
  obtenerMedia(@OrgId() orgId: string, @Param('id') id: string, @Param('mensajeId') mensajeId: string) {
    return this.mensajes.obtenerMedia(orgId, id, mensajeId);
  }

  @Delete('conversaciones/:id/mensajes/:mensajeId')
  eliminarMensaje(@OrgId() orgId: string, @Param('id') id: string, @Param('mensajeId') mensajeId: string) {
    return this.mensajes.eliminarMensaje(orgId, id, mensajeId);
  }

  @Get('webhook-url')
  webhookUrl(@OrgId() orgId: string, @Req() req: Request) {
    const origen = `${req.protocol}://${req.get('host')}`;
    return { url: this.mensajes.urlWebhook(orgId, origen) };
  }

  @Post('sincronizar')
  sincronizar(@OrgId() orgId: string) {
    return this.mensajes.sincronizarWhatsappQr(orgId);
  }
}
