import { BadRequestException } from '@nestjs/common';

/** Dominios de correo de la institución (ej. "cpmv.fin.ec"), separados por coma en
 *  CORREO_DOMINIOS_PERMITIDOS. Vacío = sin restricción (desarrollo local). */
export function dominiosPermitidos(): string[] {
  return (process.env.CORREO_DOMINIOS_PERMITIDOS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

/** El acceso al CRM depende del correo (activación de la cuenta y código de cada inicio de
 *  sesión), así que solo se aceptan buzones de la institución: con un correo personal, el
 *  control de la cuenta quedaría fuera de la institución. */
export function exigirCorreoInstitucional(email: string): void {
  const dominios = dominiosPermitidos();
  if (dominios.length === 0) return;
  const dominio = email.split('@').pop()?.toLowerCase() ?? '';
  if (!dominios.includes(dominio)) {
    throw new BadRequestException(`Solo se permiten correos institucionales (@${dominios.join(', @')}).`);
  }
}

/** "ana.perez@cpmv.fin.ec" → "an•••••@cpmv.fin.ec": para decirle a la persona a dónde se mandó
 *  el código sin exponer la dirección completa en la pantalla de login. */
export function enmascararCorreo(email: string): string {
  const [usuario, dominio] = email.split('@');
  return `${usuario.slice(0, 2)}${'•'.repeat(Math.max(usuario.length - 2, 3))}@${dominio}`;
}
