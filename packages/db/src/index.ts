import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

// Cliente Prisma singleton (evita múltiples conexiones en dev/HMR).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Devuelve un "cliente con alcance de tenant".
 *
 * Esto es una conveniencia de tipos: en la práctica el aislamiento se aplica
 * en el guard/interceptor de la API (NestJS) inyectando `organizationId` en
 * cada `where`. Para defensa en profundidad se recomienda además activar
 * Row-Level Security (RLS) en Postgres por `organizationId`.
 */
export function forTenant(organizationId: string) {
  return {
    organizationId,
    prisma,
  };
}
