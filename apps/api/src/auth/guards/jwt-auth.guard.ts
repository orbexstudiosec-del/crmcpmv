import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token Bearer');
    }
    let payload: JwtPayload & { iat?: number };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { iat?: number }>(header.slice(7), { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    // Un JWT firmado sigue siendo válido hasta que expira: sin esta comprobación, cambiar la
    // contraseña no expulsaba a quien ya tuviera una sesión abierta (o robada).
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { sesionesValidasDesde: true } });
    if (!user) throw new UnauthorizedException('Token inválido o expirado');
    if (user.sesionesValidasDesde && (payload.iat ?? 0) < Math.floor(user.sesionesValidasDesde.getTime() / 1000)) {
      throw new UnauthorizedException('La sesión ya no es válida. Vuelve a iniciar sesión.');
    }
    req.user = payload;
    return true;
  }
}
