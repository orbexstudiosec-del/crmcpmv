import type { PrismaService } from '../prisma/prisma.service';

/** "  Tulcán " y "TULCAN" son la misma ciudad: sin acentos, sin mayúsculas, sin espacios de más. */
export function normalizarCiudad(ciudad?: string | null): string {
  return (ciudad ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Agencia que debe atender a un prospecto según su ciudad. Si varias agencias cubren la misma
 * ciudad (ej. tres en Ibarra), le toca a la que tiene menos prospectos abiertos en ese momento,
 * para repartir la carga de forma pareja. Devuelve null si ninguna agencia cubre esa ciudad:
 * el prospecto queda "sin agencia" hasta que un administrador lo asigne a mano. */
export async function sucursalParaCiudad(prisma: PrismaService, organizationId: string, ciudad?: string | null): Promise<string | null> {
  const clave = normalizarCiudad(ciudad);
  if (!clave) return null;

  const sucursales = await prisma.sucursal.findMany({
    where: { organizationId, ciudad: { not: null } },
    select: {
      id: true,
      ciudad: true,
      _count: { select: { leads: { where: { estado: { in: ['NUEVO', 'CONTACTADO', 'CALIFICADO'] } } } } },
    },
    orderBy: { nombre: 'asc' },
  });
  const candidatas = sucursales.filter((s) => normalizarCiudad(s.ciudad) === clave);
  if (candidatas.length === 0) return null;
  return candidatas.reduce((menor, s) => (s._count.leads < menor._count.leads ? s : menor)).id;
}

/** Ciudades que cubre alguna agencia, sin repetir y en orden alfabético (para listas de selección). */
export async function ciudadesConAgencia(prisma: PrismaService, organizationId: string): Promise<string[]> {
  const sucursales = await prisma.sucursal.findMany({ where: { organizationId, ciudad: { not: null } }, select: { ciudad: true } });
  const porClave = new Map<string, string>();
  for (const s of sucursales) {
    const clave = normalizarCiudad(s.ciudad);
    if (clave && !porClave.has(clave)) porClave.set(clave, s.ciudad!.trim());
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Agencia a la que está limitado un miembro al ver prospectos: los agentes y supervisores que
 * pertenecen a una agencia solo ven los de la suya. null = sin límite (administradores,
 * gerencia, o personal que no está asignado a ninguna agencia). */
export async function agenciaDelMiembro(prisma: PrismaService, membershipId: string | null): Promise<string | null> {
  if (!membershipId) return null;
  const miembro = await prisma.membership.findUnique({ where: { id: membershipId }, select: { rol: true, sucursalId: true } });
  if (!miembro?.sucursalId) return null;
  return miembro.rol === 'AGENTE' || miembro.rol === 'SUPERVISOR' ? miembro.sucursalId : null;
}
