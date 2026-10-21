export interface Pais {
  iso: string;
  nombre: string;
  dial: string;
}

/**
 * Códigos de país para el selector de teléfono/WhatsApp — Ecuador primero (mercado principal).
 * Sin emoji de bandera a propósito: Windows (10 y buena parte de 11) no tiene el glifo de bandera
 * en las fuentes del sistema y en un <select> nativo cae al fallback de "EC" en texto plano dentro
 * de un cuadro — se ve como un bug. El código ISO como texto explícito es la alternativa fiable.
 */
export const PAISES: Pais[] = [
  { iso: "EC", nombre: "Ecuador", dial: "+593" },
  { iso: "CO", nombre: "Colombia", dial: "+57" },
  { iso: "PE", nombre: "Perú", dial: "+51" },
  { iso: "MX", nombre: "México", dial: "+52" },
  { iso: "CL", nombre: "Chile", dial: "+56" },
  { iso: "AR", nombre: "Argentina", dial: "+54" },
  { iso: "BO", nombre: "Bolivia", dial: "+591" },
  { iso: "VE", nombre: "Venezuela", dial: "+58" },
  { iso: "PY", nombre: "Paraguay", dial: "+595" },
  { iso: "UY", nombre: "Uruguay", dial: "+598" },
  { iso: "PA", nombre: "Panamá", dial: "+507" },
  { iso: "CR", nombre: "Costa Rica", dial: "+506" },
  { iso: "GT", nombre: "Guatemala", dial: "+502" },
  { iso: "HN", nombre: "Honduras", dial: "+504" },
  { iso: "SV", nombre: "El Salvador", dial: "+503" },
  { iso: "NI", nombre: "Nicaragua", dial: "+505" },
  { iso: "DO", nombre: "Rep. Dominicana", dial: "+1" },
  { iso: "US", nombre: "Estados Unidos", dial: "+1" },
  { iso: "ES", nombre: "España", dial: "+34" },
  { iso: "BR", nombre: "Brasil", dial: "+55" },
];

export interface TelefonoValor {
  pais: string;
  numero: string;
}

/** Combina código de país + número local en un E.164 aproximado (solo dígitos, con "+"). undefined si no hay número. */
export function telefonoCompleto(pais: string, numero: string): string | undefined {
  const digitos = numero.replace(/\D/g, "");
  return digitos ? `${pais}${digitos}` : undefined;
}

/** Inversa de telefonoCompleto: separa un teléfono guardado en pais+numero para prellenar el formulario de edición. */
export function dividirTelefono(telefono: string | null | undefined): TelefonoValor {
  if (!telefono) return { pais: "+593", numero: "" };
  const limpio = telefono.trim().replace(/[^\d+]/g, "");
  const conMas = limpio.startsWith("+") ? limpio : `+${limpio}`;
  const porLongitud = [...PAISES].sort((a, b) => b.dial.length - a.dial.length);
  for (const p of porLongitud) {
    if (conMas.startsWith(p.dial)) return { pais: p.dial, numero: conMas.slice(p.dial.length) };
  }
  return { pais: "+593", numero: conMas.replace("+", "") };
}

/** Link de chat directo de WhatsApp (wa.me exige solo dígitos, sin "+"). null si no hay teléfono. */
export function whatsappUrl(telefono: string | null | undefined): string | null {
  const digitos = telefono?.replace(/\D/g, "");
  return digitos ? `https://wa.me/${digitos}` : null;
}
