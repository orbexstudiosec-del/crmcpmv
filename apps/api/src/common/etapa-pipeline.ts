import type { EtapaPipelineDef } from '@totalcrm/shared';
import type { PrismaService } from '../prisma/prisma.service';

/** Las 6 etapas de fábrica — se usan solo cuando el workspace no ha personalizado nada
 * todavía (Organization.pipelineEtapas === null). Debe reflejar ETAPAS_PIPELINE_DEFAULT de
 * apps/web/lib/crm.ts (duplicado a propósito: el front no depende de @totalcrm/shared). */
export const ETAPAS_PIPELINE_DEFAULT: EtapaPipelineDef[] = [
  { id: 'PROSPECTO', label: 'Prospecto', color: '#2a78d6', tipo: 'ABIERTA' },
  { id: 'CONTACTO', label: 'Contacto', color: '#1baf7a', tipo: 'ABIERTA' },
  { id: 'PROPUESTA', label: 'Propuesta', color: '#eda100', tipo: 'ABIERTA' },
  { id: 'NEGOCIACION', label: 'Negociación', color: '#7c5cfc', tipo: 'ABIERTA' },
  { id: 'GANADA', label: 'Ganada', color: '#16a34a', tipo: 'GANADA' },
  { id: 'PERDIDA', label: 'Perdida', color: '#dc2626', tipo: 'PERDIDA' },
];

/** Comparte la resolución/validación del embudo entre PipelineService (oportunidades) y
 * MensajesService (cambiar etapa desde el inbox) — vive en `common` porque ambos módulos la
 * necesitan, igual que webhook-url.ts. */
export async function etapasPipelineOrg(prisma: PrismaService, organizationId: string): Promise<EtapaPipelineDef[]> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { pipelineEtapas: true } });
  const etapas = org?.pipelineEtapas as EtapaPipelineDef[] | null;
  return etapas && etapas.length ? etapas : ETAPAS_PIPELINE_DEFAULT;
}

export async function etapaPipelineValida(prisma: PrismaService, organizationId: string, etapa: string): Promise<boolean> {
  const etapas = await etapasPipelineOrg(prisma, organizationId);
  return etapas.some((e) => e.id === etapa);
}

/** La primera etapa del embudo del workspace — se usa como etapa inicial al crear una
 * oportunidad, en vez de asumir que "PROSPECTO" siempre existe (el workspace pudo haberla
 * renombrado o eliminado). */
export async function primeraEtapaPipeline(prisma: PrismaService, organizationId: string): Promise<string> {
  const etapas = await etapasPipelineOrg(prisma, organizationId);
  return etapas[0].id;
}
