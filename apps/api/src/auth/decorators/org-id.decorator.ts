import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Inyecta el organizationId ya validado por TenancyGuard. */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().organizationId;
  },
);
