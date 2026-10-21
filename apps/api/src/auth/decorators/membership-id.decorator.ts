import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Inyecta el id del Membership del usuario autenticado en la org activa (ya resuelto por
 *  TenancyGuard). */
export const MembershipId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    return ctx.switchToHttp().getRequest().membershipId ?? null;
  },
);
