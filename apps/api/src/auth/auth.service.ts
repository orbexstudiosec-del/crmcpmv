import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginInput, LoginCodigoInput } from '@totalcrm/shared';
import { MENSAJE_CUENTA_NO_ACTIVADA } from '@totalcrm/shared';
import { MailService } from './mail.service';
import { authSecret } from '../common/secretos';
import { enmascararCorreo } from '../common/correo-institucional';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  /** Momento de emisión en milisegundos (iat va en segundos): permite invalidar con precisión las
   *  sesiones emitidas antes de un cambio de contraseña o de correo. */
  emitidaEn?: number;
}

// Hash bcrypt fijo (de una contraseña aleatoria descartada) para la comparación dummy del login.
const DUMMY_HASH = '$2a$10$2EvdAM6IE0NRyu74VRRCA.5dLGBYa3G8SLPgzN27XVkptxpWVOEly';

const MINUTOS_CODIGO = 10;
const MAX_INTENTOS_CODIGO = 5;
const HORAS_INVITACION = 72;
const MENSAJE_CODIGO_INVALIDO = 'El código no es válido o ya venció. Vuelve a iniciar sesión para recibir uno nuevo.';

const urlWeb = () => (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** HMAC con el secreto del servidor, no un hash simple: un código de 6 dígitos con sha256 a
 *  secas se adivina al instante con una copia de la base. Incluye el desafío para que el mismo
 *  código no valga en otro desafío. */
function hashCodigo(desafio: string, codigo: string): string {
  return createHmac('sha256', authSecret()).update(`${desafio}:${codigo}`).digest('hex');
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  /** Primer paso: contraseña. Si es correcta, NO entrega la sesión todavía: manda un código al
   *  correo institucional y devuelve el desafío con el que el segundo paso lo canjea. */
  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Siempre se corre un bcrypt.compare, exista el usuario o no: así el tiempo de respuesta no
    // delata qué correos están registrados (enumeración por temporización). DUMMY_HASH es un
    // hash real de una contraseña aleatoria, nunca va a coincidir.
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !ok) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.emailVerified) throw new UnauthorizedException(MENSAJE_CUENTA_NO_ACTIVADA);

    const desafio = randomUUID();
    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      // Un solo código vigente por persona: pedir otro invalida los anteriores.
      this.prisma.codigoAcceso.updateMany({ where: { userId: user.id, usadoEn: null }, data: { usadoEn: new Date() } }),
      this.prisma.codigoAcceso.create({
        data: { id: desafio, userId: user.id, codigoHash: hashCodigo(desafio, codigo), expiresAt: new Date(Date.now() + MINUTOS_CODIGO * 60_000) },
      }),
    ]);
    await this.mail.enviarCodigoAcceso(user.email, user.nombre, codigo, MINUTOS_CODIGO);

    return { requiereCodigo: true as const, desafio, correo: enmascararCorreo(user.email) };
  }

  /** Segundo paso: canjea el código del correo por la sesión. Cada desafío admite pocos intentos
   *  y vence en minutos; además el endpoint tiene límite por IP. */
  async verificarCodigo({ desafio, codigo }: LoginCodigoInput) {
    const registro = await this.prisma.codigoAcceso.findUnique({ where: { id: desafio } });
    if (!registro || registro.usadoEn || registro.expiresAt < new Date() || registro.intentos >= MAX_INTENTOS_CODIGO) {
      throw new UnauthorizedException(MENSAJE_CODIGO_INVALIDO);
    }

    if (!igualesEnTiempoConstante(hashCodigo(desafio, codigo), registro.codigoHash)) {
      const intentos = registro.intentos + 1;
      await this.prisma.codigoAcceso.update({
        where: { id: desafio },
        data: { intentos, ...(intentos >= MAX_INTENTOS_CODIGO ? { usadoEn: new Date() } : {}) },
      });
      const restantes = MAX_INTENTOS_CODIGO - intentos;
      throw new UnauthorizedException(restantes > 0 ? `Código incorrecto. Te quedan ${restantes} intento(s).` : MENSAJE_CODIGO_INVALIDO);
    }

    // updateMany condicionado: si dos pestañas canjean el mismo código a la vez, solo una gana.
    const canje = await this.prisma.codigoAcceso.updateMany({ where: { id: desafio, usadoEn: null }, data: { usadoEn: new Date() } });
    if (canje.count === 0) throw new UnauthorizedException(MENSAJE_CODIGO_INVALIDO);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: registro.userId },
      include: { memberships: { include: { organization: true } } },
    });
    return {
      token: await this.firmarToken(user.id, user.email),
      user: { id: user.id, nombre: user.nombre, email: user.email },
      organizaciones: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        rol: m.rol,
        nombre: m.organization.nombre,
      })),
    };
  }

  /** "Olvidé mi contraseña". Siempre responde { ok: true } exista o no el correo — no revelar
   *  si un correo está registrado es una medida básica anti-enumeración. A quien todavía no
   *  activó su cuenta se le reenvía la invitación (es el mismo enlace). */
  async solicitarReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.emailVerified) {
        const link = await this.crearEnlaceContrasena(user.id, 60 * 60 * 1000);
        await this.mail.enviarResetPassword(user.email, user.nombre, link);
      } else {
        await this.invitar(user.id);
      }
    }
    return { ok: true };
  }

  /** Envía (o reenvía) el enlace de activación de la cuenta al correo institucional. */
  async invitar(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const link = await this.crearEnlaceContrasena(user.id, HORAS_INVITACION * 60 * 60 * 1000, true);
    await this.mail.enviarInvitacion(user.email, user.nombre, link, HORAS_INVITACION);
  }

  /** Define la contraseña desde el enlace del correo: sirve tanto para activar una cuenta nueva
   *  como para restablecer una existente. Abrir el enlace prueba que el buzón es de la persona,
   *  así que también marca la cuenta como activada. */
  async restablecerPassword(tokenCrudo: string, password: string) {
    const tokenHash = createHash('sha256').update(tokenCrudo).digest('hex');
    const registro = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
      throw new BadRequestException('El link no es válido o ya expiró');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const ahora = new Date();
    // Se consumen TODOS los links pendientes del usuario (no solo este) y se invalidan las
    // sesiones abiertas: si alguien más tenía otro link o una sesión robada, deja de servirle.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: registro.userId },
        data: { passwordHash, sesionesValidasDesde: ahora, emailVerified: registro.user.emailVerified ?? ahora },
      }),
      this.prisma.passwordResetToken.updateMany({ where: { userId: registro.userId, usedAt: null }, data: { usedAt: ahora } }),
    ]);
    return { ok: true };
  }

  private async crearEnlaceContrasena(userId: string, validezMs: number, activacion = false): Promise<string> {
    const tokenCrudo = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(tokenCrudo).digest('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + validezMs) },
    });
    return `${urlWeb()}/restablecer?token=${tokenCrudo}${activacion ? '&activar=1' : ''}`;
  }

  private firmarToken(sub: string, email: string): Promise<string> {
    const payload: JwtPayload = { sub, email, emitidaEn: Date.now() };
    return this.jwt.signAsync(payload);
  }
}
