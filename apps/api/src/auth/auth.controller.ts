import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AuthService } from './auth.service';
import { loginSchema, loginCodigoSchema, solicitarResetSchema, restablecerPasswordSchema } from '@totalcrm/shared';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Paso 1: contraseña → envía el código al correo institucional. */
  @Post('login')
  @RateLimit({ max: 10, ventanaMs: 60_000 }) // 10 intentos de login por IP por minuto
  login(@Body() body: unknown) {
    return this.auth.login(loginSchema.parse(body));
  }

  /** Paso 2: código del correo → sesión. */
  @Post('login/codigo')
  @RateLimit({ max: 10, ventanaMs: 60_000 })
  verificarCodigo(@Body() body: unknown) {
    return this.auth.verificarCodigo(loginCodigoSchema.parse(body));
  }

  @Post('forgot-password')
  @RateLimit({ max: 5, ventanaMs: 300_000 })
  forgotPassword(@Body() body: unknown) {
    return this.auth.solicitarReset(solicitarResetSchema.parse(body).email);
  }

  /** Define la contraseña desde el enlace del correo (activación de cuenta o restablecimiento). */
  @Post('reset-password')
  @RateLimit({ max: 10, ventanaMs: 300_000 })
  resetPassword(@Body() body: unknown) {
    const { token, password } = restablecerPasswordSchema.parse(body);
    return this.auth.restablecerPassword(token, password);
  }
}
