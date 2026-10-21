import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginInput } from '@totalcrm/shared';
import { MENSAJE_EMAIL_NO_VERIFICADO } from '@totalcrm/shared';
import { MailService } from './mail.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
}

// Hash bcrypt fijo (de una contraseña aleatoria descartada) para la comparación dummy del login.
const DUMMY_HASH = '$2a$10$2EvdAM6IE0NRyu74VRRCA.5dLGBYa3G8SLPgzN27XVkptxpWVOEly';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: { include: { organization: true } } },
    });
    // Siempre se corre un bcrypt.compare, exista el usuario o no: así el tiempo de respuesta no
    // delata qué correos están registrados (enumeración por temporización). DUMMY_HASH es un
    // hash real de una contraseña aleatoria, nunca va a coincidir.
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !ok) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.emailVerified) throw new UnauthorizedException(MENSAJE_EMAIL_NO_VERIFICADO);

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

  /** Inicia el flujo de "olvidé mi contraseña". Siempre responde { ok: true } exista o no el
   *  email — no revelar si un correo está registrado es una medida básica anti-enumeración. */
  async solicitarReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const tokenCrudo = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(tokenCrudo).digest('hex');
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const link = `${process.env.WEB_URL ?? 'http://localhost:3000'}/restablecer?token=${tokenCrudo}`;
      await this.mail.enviarResetPassword(user.email, user.nombre, link);
    }
    return { ok: true };
  }

  /** Completa el flujo: valida el token (por hash, sin usar, sin expirar) y actualiza la contraseña. */
  async restablecerPassword(tokenCrudo: string, password: string) {
    const tokenHash = createHash('sha256').update(tokenCrudo).digest('hex');
    const registro = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
      throw new BadRequestException('El link no es válido o ya expiró');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const ahora = new Date();
    // Se consumen TODOS los links pendientes del usuario (no solo este) y se invalidan las
    // sesiones abiertas: si alguien más tenía otro link o una sesión robada, deja de servirle.
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: registro.userId }, data: { passwordHash, sesionesValidasDesde: ahora } }),
      this.prisma.passwordResetToken.updateMany({ where: { userId: registro.userId, usedAt: null }, data: { usedAt: ahora } }),
    ]);
    return { ok: true };
  }

  /** Completa la verificación: valida el token (por hash, sin usar, sin expirar), marca el
   *  correo como confirmado y devuelve una sesión ya lista (mismo shape que login) para poder
   *  entrar directo sin pedirle la contraseña de nuevo. */
  async verificarEmail(tokenCrudo: string) {
    const tokenHash = createHash('sha256').update(tokenCrudo).digest('hex');
    const registro = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
      throw new BadRequestException('El link no es válido o ya expiró. Pide que te reenviemos la verificación.');
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: registro.userId },
        data: { emailVerified: new Date() },
        include: { memberships: { include: { organization: true } } },
      }),
      this.prisma.emailVerificationToken.update({ where: { id: registro.id }, data: { usedAt: new Date() } }),
    ]);

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

  /** Igual que solicitarReset: siempre responde { ok: true } exista o no el email — no revelar
   *  si un correo está registrado. Si ya está verificado, no hace nada (no tiene sentido reenviar). */
  async reenviarVerificacion(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      await this.enviarVerificacion(user.id, user.email, user.nombre);
    }
    return { ok: true };
  }

  private async enviarVerificacion(userId: string, email: string, nombre: string): Promise<void> {
    const tokenCrudo = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(tokenCrudo).digest('hex');
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    const link = `${process.env.WEB_URL ?? 'http://localhost:3000'}/verificar?token=${tokenCrudo}`;
    await this.mail.enviarVerificacionEmail(email, nombre, link);
  }

  private firmarToken(sub: string, email: string): Promise<string> {
    const payload: JwtPayload = { sub, email };
    return this.jwt.signAsync(payload);
  }
}
