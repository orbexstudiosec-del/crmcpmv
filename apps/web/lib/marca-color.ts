/** Variables CSS que el tema deriva de los colores de la marca. Sin "use client" a propósito:
 * las usa el servidor (app/layout.tsx las pone en el <html> del primer render) y el cliente
 * (lib/marca.tsx las actualiza en vivo al editar la marca).
 *
 * `principal` tiñe botones, enlaces, el menú lateral y los fondos oscuros; `secundario` es el
 * color de acento (resaltados, degradados). Cada uno se puede definir sin el otro. */
export function variablesColorMarca(principal: string | null, secundario: string | null): Record<string, string> {
  const variables: Record<string, string> = {};
  if (principal) {
    Object.assign(variables, {
      "--color-primary": principal,
      "--color-primary-dark": `color-mix(in srgb, ${principal} 80%, black)`,
      "--color-primary-light": `color-mix(in srgb, ${principal} 75%, white)`,
      // Sobre var(--card) para que funcione igual en tema claro y oscuro.
      "--primary-soft": `color-mix(in srgb, ${principal} 14%, var(--card))`,
      // Fondos oscuros (menú lateral, panel del acceso): el propio color de marca oscurecido
      // con negro puro, para que siga leyéndose como ese color y no como un gris teñido.
      "--color-navy": `color-mix(in srgb, ${principal} 66%, black)`,
      "--color-navy-dark": `color-mix(in srgb, ${principal} 44%, black)`,
      "--color-brand": principal,
      "--color-brand-dark": `color-mix(in srgb, ${principal} 80%, black)`,
      "--color-brand-light": `color-mix(in srgb, ${principal} 75%, white)`,
      "--color-brand-100": `color-mix(in srgb, ${principal} 15%, white)`,
    });
  }
  const acento = secundario ?? (principal ? `color-mix(in srgb, ${principal} 80%, white)` : null);
  if (acento) {
    variables["--color-accent"] = acento;
    variables["--color-accent-glow"] = secundario ?? `color-mix(in srgb, ${acento} 45%, white)`;
  }
  return variables;
}
