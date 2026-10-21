import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AuthService } from './auth.service';
import {
  loginSchema, solicitarResetSchema, restablecerPasswordSchema,
  verificarEmailSchema, reenviarVerificacionSchema,
} from '@totalcrm/shared';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @RateLimit({ max: 10, ventanaMs: 60_000 }) // 10 intentos de login por IP por minuto
  login(@Body() body: unknown) {
    return this.auth.login(loginSchema.parse(body));
  }

  @Post('forgot-password')
  @RateLimit({ max: 5, ventanaMs: 300_000 })
  forgotPassword(@Body() body: unknown) {
    return this.auth.solicitarReset(solicitarResetSchema.parse(body).email);
  }

  @Post('reset-password')
  @RateLimit({ max: 10, ventanaMs: 300_000 })
  resetPassword(@Body() body: unknown) {
    const { token, password } = restablecerPasswordSchema.parse(body);
    return this.auth.restablecerPassword(token, password);
  }

  @Post('verify-email')
  @RateLimit({ max: 10, ventanaMs: 300_000 })
  verifyEmail(@Body() body: unknown) {
    return this.auth.verificarEmail(verificarEmailSchema.parse(body).token);
  }

  @Post('resend-verification')
  @RateLimit({ max: 5, ventanaMs: 300_000 })
  resendVerification(@Body() body: unknown) {
    return this.auth.reenviarVerificacion(reenviarVerificacionSchema.parse(body).email);
  }
}
