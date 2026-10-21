import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MarcaService } from '../marca/marca.service';

/** Los nombres de los prospectos llegan del formulario público: sin escaparlos, cualquiera podía
 *  meter HTML (enlaces, botones falsos) en un correo legítimo enviado a los jefes de agencia. */
function esc(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly marca: MarcaService) {
    this.transporter = process.env.SMTP_HOST
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        })
      : null;
  }

  /** Si no hay SMTP configurado (típico en dev local), el link se imprime en la consola del
   *  API en vez de enviarse por correo — así el flujo completo se puede probar sin credenciales
   *  de un proveedor de correo real. En producción, configurar SMTP_HOST/PORT/USER/PASS/FROM. */
  async enviarResetPassword(destinatario: string, nombre: string, link: string) {
    if (!this.transporter) {
      this.logger.warn(`SMTP no configurado — link de reset para ${destinatario}: ${link}`);
      return;
    }

    const marca = await this.marca.nombre();
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || `${marca} <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: `Restablece tu contraseña — ${marca}`,
      text: `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contraseña. Este link es válido por 1 hora:\n\n${link}\n\nSi no fuiste tú, ignora este correo.`,
      html: `<p>Hola ${esc(nombre)},</p><p>Recibimos una solicitud para restablecer tu contraseña. Este link es válido por 1 hora:</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
    });
  }

  /** ¿Hay un servidor de correo configurado? El módulo de Riesgos lo consulta para avisar en
   *  la interfaz si los lotes solo quedarán en el log en vez de enviarse de verdad. */
  get smtpConfigurado(): boolean {
    return this.transporter !== null;
  }

  /** Envía a los jefes de una agencia el lote de prospectos aprobados listos para gestionar.
   *  Devuelve true si salió por SMTP real, false si solo se registró en el log (sin SMTP). */
  async enviarLoteProspectos(
    destinatarios: string[],
    agencia: string,
    prospectos: { nombre: string; telefono: string | null; ciudad: string | null; montoAprobado: string | null; nivel: string | null }[],
    enlace: string,
  ): Promise<boolean> {
    if (destinatarios.length === 0 || prospectos.length === 0) return false;
    const marca = await this.marca.nombre();
    const asunto = `${prospectos.length} prospecto(s) aprobado(s) — ${agencia}`;

    const lineas = prospectos.map((p, i) =>
      `${i + 1}. ${p.nombre}${p.telefono ? ` · ${p.telefono}` : ''}${p.ciudad ? ` · ${p.ciudad}` : ''}` +
      `${p.montoAprobado ? ` · Monto aprobado: $${Number(p.montoAprobado).toFixed(2)}` : ''}${p.nivel ? ` · Riesgo ${p.nivel.toLowerCase()}` : ''}`);
    const texto = `Hola,\n\nEl equipo de riesgos aprobó ${prospectos.length} prospecto(s) para ${agencia}:\n\n${lineas.join('\n')}\n\nEntra al sistema para gestionarlos: ${enlace}\n\n— ${marca}`;

    const filas = prospectos.map((p) =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(p.nombre)}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(p.telefono ?? '—')}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(p.ciudad ?? '—')}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #eee">${p.montoAprobado ? '$' + Number(p.montoAprobado).toFixed(2) : '—'}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #eee">${p.nivel ? 'Riesgo ' + p.nivel.toLowerCase() : '—'}</td></tr>`).join('');
    const html = `<p>Hola,</p><p>El equipo de riesgos aprobó <b>${prospectos.length}</b> prospecto(s) para <b>${esc(agencia)}</b>:</p>` +
      `<table style="border-collapse:collapse;font-size:14px"><thead><tr>` +
      `${['Prospecto', 'Teléfono', 'Ciudad', 'Monto aprobado', 'Riesgo'].map((h) => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ccc">${h}</th>`).join('')}` +
      `</tr></thead><tbody>${filas}</tbody></table>` +
      `<p style="margin-top:16px"><a href="${esc(enlace)}" style="background:#00953a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Gestionar en el sistema</a></p><p style="color:#888">— ${esc(marca)}</p>`;

    if (!this.transporter) {
      this.logger.warn(`SMTP no configurado — lote de ${prospectos.length} prospecto(s) de ${agencia} para ${destinatarios.join(', ')}:\n${texto}`);
      return false;
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || `${marca} <${process.env.SMTP_USER}>`,
      to: destinatarios.join(', '),
      subject: asunto,
      text: texto,
      html,
    });
    return true;
  }

  /** Igual que enviarResetPassword: si no hay SMTP configurado, el link queda en el log del
   *  API en vez de perderse — así el registro sigue siendo probable en dev sin credenciales reales. */
  async enviarVerificacionEmail(destinatario: string, nombre: string, link: string) {
    if (!this.transporter) {
      this.logger.warn(`SMTP no configurado — link de verificación para ${destinatario}: ${link}`);
      return;
    }

    const marca = await this.marca.nombre();
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || `${marca} <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: `Confirma tu correo — ${marca}`,
      text: `Hola ${nombre},\n\nConfirma tu correo para activar tu cuenta de ${marca}. Este link es válido por 24 horas:\n\n${link}\n\nSi no creaste esta cuenta, ignora este correo.`,
      html: `<p>Hola ${esc(nombre)},</p><p>Confirma tu correo para activar tu cuenta de ${esc(marca)}. Este link es válido por 24 horas:</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>Si no creaste esta cuenta, ignora este correo.</p>`,
    });
  }
}
