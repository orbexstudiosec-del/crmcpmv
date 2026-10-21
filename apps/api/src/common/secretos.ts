const PLACEHOLDERS = ['dev-secret-cambialo', 'cambia-esto-por-un-secreto-largo-y-aleatorio'];

/** Secreto con el que se firman los JWT de sesión. No hay valor por defecto a propósito: una
 * instalación que arrancara con un secreto conocido dejaría falsificar sesiones de cualquier
 * usuario. El instalador lo genera; si falta, el API se niega a arrancar. */
export function authSecret(): string {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32 || PLACEHOLDERS.includes(secreto)) {
    throw new Error('AUTH_SECRET falta o es inseguro (mínimo 32 caracteres). Genera uno con: openssl rand -hex 32');
  }
  return secreto;
}
