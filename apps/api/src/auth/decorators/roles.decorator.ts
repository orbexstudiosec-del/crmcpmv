import { SetMetadata } from '@nestjs/common';
import type { RolMiembro } from '@totalcrm/shared';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a los roles indicados. Requiere TenancyGuard antes en la cadena. */
export const Roles = (...roles: RolMiembro[]) => SetMetadata(ROLES_KEY, roles);
