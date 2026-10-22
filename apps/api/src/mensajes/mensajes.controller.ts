import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MensajesService } from './mensajes.service';
import {
  enviarMensajeSchema, iniciarConversacionSchema,
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
    const { numero } = iniciarConversacionSchema.parse(body);
    return this.mensajes.iniciarConversacion(orgId, numero);
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

  @Delete('conversaciones/:id/mensajes/:mensajeId')
  eliminarMensaje(@OrgId() orgId: string, @Param('id') id: string, @Param('mensajeId') mensajeId: string) {
    return this.mensajes.eliminarMensaje(orgId, id, mensajeId);
  }
}
