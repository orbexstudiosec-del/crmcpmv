import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
    if (!this.transporter && process.env.NODE_ENV === 'production') {
      this.logger.error('SMTP_HOST no está configurado: sin correo institucional nadie puede activar su cuenta ni recibir el código para iniciar sesión.');
    }
  }

  /** Correos de acceso (enlace para definir la contraseña y código de inicio de sesión). Sin
   *  SMTP, en desarrollo el contenido se imprime en el log del API para poder probar el flujo; en
   *  producción NO: un código o enlace en el log dejaría entrar a quien lea el log, así que se
   *  corta con un error claro (el acceso depende de que el correo institucional esté configurado). */
  private async enviarAcceso(destinatario: string, asunto: string, texto: string, html: string, resumenLog: string) {
    if (!this.transporter) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(`SMTP no configurado: no se pudo enviar "${asunto}" a ${destinatario}.`);
        throw new ServiceUnavailableException('El servidor no tiene configurado el correo institucional (SMTP). Avisa al área de Sistemas.');
      }
      this.logger.warn(`SMTP no configurado (desarrollo) — ${resumenLog}`);
      return;
    }
    const marca = await this.marca.nombre();
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || `${marca} <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: `${asunto} — ${marca}`,
      text: texto,
      html,
    });
  }

  async enviarResetPassword(destinatario: string, nombre: string, link: string) {
    await this.enviarAcceso(
      destinatario, 'Restablece tu contraseña',
      `Hola ${nombre},

Recibimos una solicitud para restablecer tu contraseña. Este link es válido por 1 hora:

${link}

Si no fuiste tú, ignora este correo y avisa al área de Sistemas.`,
      `<p>Hola ${esc(nombre)},</p><p>Recibimos una solicitud para restablecer tu contraseña. Este link es válido por 1 hora:</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>Si no fuiste tú, ignora este correo y avisa al área de Sistemas.</p>`,
      `link de reset para ${destinatario}: ${link}`,
    );
  }

  /** Alta de un usuario: el administrador lo crea y la persona define su contraseña desde este
   *  enlace (el administrador nunca la conoce, y abrirlo prueba que el buzón es suyo). */
  async enviarInvitacion(destinatario: string, nombre: string, link: string, horasValidez: number) {
    const marca = await this.marca.nombre();
    await this.enviarAcceso(
      destinatario, 'Activa tu cuenta',
      `Hola ${nombre},

Se creó tu usuario en ${marca}. Para activarlo, define tu contraseña en este enlace (válido por ${horasValidez} horas):

${link}

Cada vez que inicies sesión te enviaremos además un código a este correo.`,
      `<p>Hola ${esc(nombre)},</p><p>Se creó tu usuario en <b>${esc(marca)}</b>. Para activarlo, define tu contraseña en este enlace (válido por ${horasValidez} horas):</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>Cada vez que inicies sesión te enviaremos además un código a este correo.</p>`,
      `invitación para ${destinatario}: ${link}`,
    );
  }

  /** Segundo factor: código de un solo uso para terminar de iniciar sesión. */
  async enviarCodigoAcceso(destinatario: string, nombre: string, codigo: string, minutosValidez: number) {
    await this.enviarAcceso(
      destinatario, `Tu código de acceso: ${codigo}`,
      `Hola ${nombre},

Tu código para iniciar sesión es: ${codigo}

Vence en ${minutosValidez} minutos. Si no estabas iniciando sesión, alguien conoce tu contraseña: cámbiala y avisa al área de Sistemas.`,
      `<p>Hola ${esc(nombre)},</p><p>Tu código para iniciar sesión es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p><p>Vence en ${minutosValidez} minutos. Si no estabas iniciando sesión, alguien conoce tu contraseña: cámbiala y avisa al área de Sistemas.</p>`,
      `código de acceso para ${destinatario}: ${codigo}`,
    );
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
}
