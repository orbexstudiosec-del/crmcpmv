import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EtapaPipelineDef, OrganizacionUpdateInput } from '@totalcrm/shared';

const SELECT = {
  id: true,
  slug: true,
  nombre: true,
  etiquetasConversacion: true,
  pipelineEtapas: true,
  umbralLoteRiesgo: true,
  createdAt: true,
};

@Injectable()
export class OrganizacionService {
  constructor(private readonly prisma: PrismaService) {}

  obtener(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: SELECT,
    });
  }

  async actualizar(organizationId: string, input: OrganizacionUpdateInput) {
    if (input.pipelineEtapas) {
      const ids = input.pipelineEtapas.map((e) => e.id);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('Hay etapas del embudo con el mismo identificador');
      }

      const orgActual = await this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { pipelineEtapas: true },
      });
      const idsAntes = ((orgActual.pipelineEtapas as EtapaPipelineDef[] | null) ?? []).map((e) => e.id);
      const idsEliminados = idsAntes.filter((id) => !ids.includes(id));
      if (idsEliminados.length) {
        const enUso = await this.prisma.oportunidad.count({
          where: { organizationId, etapa: { in: idsEliminados } },
        });
        if (enUso > 0) throw new BadRequestException('No puedes eliminar una etapa que tiene oportunidades. Muévelas primero.');
      }
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: input,
      select: SELECT,
    });
  }
}
