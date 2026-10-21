import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ClienteInput } from '@totalcrm/shared';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Clientes ──────────────────────────────────────────────────
  listarClientes(organizationId: string) {
    return this.prisma.cliente.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  crearCliente(organizationId: string, input: ClienteInput) {
    return this.prisma.cliente.create({
      data: { organizationId, ...input },
    });
  }
}
