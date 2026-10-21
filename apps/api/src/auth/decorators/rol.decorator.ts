import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RolMiembro } from '@totalcrm/shared';

/** Inyecta el rol del usuario autenticado en la org activa (ya resuelto por TenancyGuard).
 *  Sirve para reglas de autorización más finas que las que da @Roles() a nivel de endpoint. */
export const Rol = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RolMiembro => {
    return ctx.switchToHttp().getRequest().rol;
  },
);
