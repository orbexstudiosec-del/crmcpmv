import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { exigirCorreoInstitucional } from '../common/correo-institucional';
import type { MiembroInput, ActualizarMiembroInput, DepartamentoInput, SucursalInput, ActualizarSucursalInput, RolMiembro } from '@totalcrm/shared';

const MIEMBRO_SELECT = {
  id: true,
  rol: true,
  createdAt: true,
  departamento: { select: { id: true, nombre: true } },
  sucursal: { select: { id: true, nombre: true } },
  user: { select: { id: true, nombre: true, email: true, emailVerified: true } },
};

/** Solo un OWNER puede crear o modificar cuentas de nivel OWNER, o degradar al propietario.
 *  Evita que un ADMIN se ascienda a OWNER, cree otro OWNER, o deje fuera al dueño real. */
function exigirGestionDeOwner(actorRol: RolMiembro, condicion: boolean, mensaje: string) {
  if (condicion && actorRol !== 'OWNER') throw new ForbiddenException(mensaje);
}

@Injectable()
export class EquipoService {
  private readonly logger = new Logger(EquipoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ── Miembros ──────────────────────────────────────────────────
  listarMiembros(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      select: MIEMBRO_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Alta de un miembro. No lleva contraseña: la persona la define desde el enlace de activación
   *  que le llega a su correo institucional (el administrador nunca la conoce). */
  async agregarMiembro(organizationId: string, input: MiembroInput, actorRol: RolMiembro) {
    exigirGestionDeOwner(actorRol, input.rol === 'OWNER', 'Solo el propietario puede crear otra cuenta de propietario.');
    exigirCorreoInstitucional(input.email);
    if (input.departamentoId) {
      const dep = await this.prisma.departamento.findFirst({
        where: { id: input.departamentoId, organizationId },
      });
      if (!dep) throw new BadRequestException('El departamento no existe en esta organización');
    }
    if (input.sucursalId) {
      const suc = await this.prisma.sucursal.findFirst({
        where: { id: input.sucursalId, organizationId },
      });
      if (!suc) throw new BadRequestException('La sucursal no existe en esta organización');
    }

    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (user) {
      const yaMiembro = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId } },
      });
      if (yaMiembro) throw new ConflictException('Ese usuario ya pertenece a esta organización');
    } else {
      user = await this.prisma.user.create({ data: { nombre: input.nombre, email: input.email } });
    }

    const miembro = await this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        rol: input.rol,
        departamentoId: input.departamentoId ?? null,
        sucursalId: input.sucursalId ?? null,
      },
      select: MIEMBRO_SELECT,
    });
    // Si la invitación no sale (correo caído), el miembro ya quedó creado: se avisa para que se
    // reenvíe desde Equipo en vez de fallar toda la operación.
    const avisoInvitacion = user.emailVerified ? null : await this.enviarInvitacion(user.id);
    return { ...miembro, avisoInvitacion };
  }

  /** null si se envió; si no, el motivo para mostrarlo en la interfaz. */
  private async enviarInvitacion(userId: string): Promise<string | null> {
    try {
      await this.authService.invitar(userId);
      return null;
    } catch (err) {
      this.logger.warn(`No se pudo enviar la invitación a ${userId}: ${err instanceof Error ? err.message : err}`);
      return `El usuario se creó, pero no se pudo enviar el correo de activación: ${err instanceof Error ? err.message : 'error desconocido'}. Usa "Reenviar invitación".`;
    }
  }

  async actualizarMiembro(organizationId: string, membershipId: string, input: ActualizarMiembroInput, actor: { rol: RolMiembro; membershipId: string | null }) {
    const miembro = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!miembro) throw new BadRequestException('El miembro no existe en esta organización');

    // Solo un OWNER puede tocar a un OWNER o ascender a alguien a OWNER (evita que un ADMIN
    // tome el control degradando al dueño o promoviéndose a sí mismo).
    exigirGestionDeOwner(actor.rol, miembro.rol === 'OWNER', 'Solo el propietario puede modificar la cuenta del propietario.');
    exigirGestionDeOwner(actor.rol, input.rol === 'OWNER' && miembro.rol !== 'OWNER', 'Solo el propietario puede ascender a alguien a propietario.');
    if (actor.membershipId === membershipId && input.rol && input.rol !== miembro.rol) {
      throw new ForbiddenException('No puedes cambiar tu propio rol.');
    }
    // No dejar sin propietario a la organización al degradar al último OWNER.
    if (miembro.rol === 'OWNER' && input.rol && input.rol !== 'OWNER') {
      const otrosOwners = await this.prisma.membership.count({ where: { organizationId, rol: 'OWNER', id: { not: membershipId } } });
      if (otrosOwners === 0) throw new BadRequestException('No puedes quitarle el rol al único propietario de la organización.');
    }

    if (input.departamentoId) {
      const dep = await this.prisma.departamento.findFirst({
        where: { id: input.departamentoId, organizationId },
      });
      if (!dep) throw new BadRequestException('El departamento no existe en esta organización');
    }
    if (input.sucursalId) {
      const suc = await this.prisma.sucursal.findFirst({
        where: { id: input.sucursalId, organizationId },
      });
      if (!suc) throw new BadRequestException('La sucursal no existe en esta organización');
    }

    // nombre/email viven en User, no en Membership — un mismo User puede pertenecer a varias
    // organizaciones, así que el cambio de nombre/email es global a la persona, no solo a este workspace.
    let cambioCorreo = false;
    if (input.nombre !== undefined || input.email !== undefined) {
      const actual = await this.prisma.user.findUniqueOrThrow({ where: { id: miembro.userId } });
      cambioCorreo = !!input.email && input.email !== actual.email;
      if (cambioCorreo) {
        exigirCorreoInstitucional(input.email!);
        const existente = await this.prisma.user.findUnique({ where: { email: input.email } });
        if (existente) throw new ConflictException('Ya existe un usuario con ese correo');
      }
      const ahora = new Date();
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: miembro.userId },
          // El acceso depende del correo: si cambia, la cuenta vuelve a activarse desde el nuevo
          // buzón (sin contraseña ni sesiones vigentes). Así quien cambia el correo no puede
          // quedarse con la cuenta de otra persona.
          data: cambioCorreo
            ? { nombre: input.nombre, email: input.email, passwordHash: null, emailVerified: null, sesionesValidasDesde: ahora }
            : { nombre: input.nombre },
        }),
        ...(cambioCorreo ? [this.prisma.passwordResetToken.updateMany({ where: { userId: miembro.userId, usedAt: null }, data: { usedAt: ahora } })] : []),
      ]);
    }

    const actualizado = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        rol: input.rol,
        departamentoId: input.departamentoId === undefined ? undefined : input.departamentoId,
        sucursalId: input.sucursalId === undefined ? undefined : input.sucursalId,
      },
      select: MIEMBRO_SELECT,
    });
    const avisoInvitacion = cambioCorreo ? await this.enviarInvitacion(miembro.userId) : null;
    return { ...actualizado, avisoInvitacion };
  }

  /** Para quien todavía no activó su cuenta (el enlace venció o no le llegó). No hay forma de
   *  activar a alguien "a mano": la activación es la prueba de que el correo es suyo. */
  async reenviarInvitacion(organizationId: string, membershipId: string) {
    const miembro = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: { select: { id: true, emailVerified: true } } },
    });
    if (!miembro) throw new BadRequestException('El miembro no existe en esta organización');
    if (miembro.user.emailVerified) throw new BadRequestException('Esta persona ya activó su cuenta. Si olvidó la contraseña, usa "Restablecer contraseña".');
    await this.authService.invitar(miembro.user.id);
    return { ok: true };
  }

  /** Le manda al miembro el mismo correo de "olvidé mi contraseña" que dispararía él mismo (o la
   *  invitación, si todavía no activó su cuenta). */
  async restablecerPassword(organizationId: string, membershipId: string) {
    const miembro = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: { select: { email: true } } },
    });
    if (!miembro) throw new BadRequestException('El miembro no existe en esta organización');
    return this.authService.solicitarReset(miembro.user.email);
  }

  async eliminarMiembro(organizationId: string, membershipId: string, actorRol: RolMiembro) {
    const miembro = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!miembro) throw new BadRequestException('El miembro no existe en esta organización');
    exigirGestionDeOwner(actorRol, miembro.rol === 'OWNER', 'Solo el propietario puede eliminar una cuenta de propietario.');
    if (miembro.rol === 'OWNER') {
      const otrosOwners = await this.prisma.membership.count({
        where: { organizationId, rol: 'OWNER', id: { not: membershipId } },
      });
      if (otrosOwners === 0) throw new BadRequestException('No puedes quitar al único administrador de la organización');
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    return { ok: true };
  }

  // ── Departamentos (área funcional) ─────────────────────────────
  listarDepartamentos(organizationId: string) {
    return this.prisma.departamento.findMany({
      where: { organizationId },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearDepartamento(organizationId: string, input: DepartamentoInput) {
    const existe = await this.prisma.departamento.findUnique({
      where: { organizationId_nombre: { organizationId, nombre: input.nombre } },
    });
    if (existe) throw new ConflictException('Ya existe un departamento con ese nombre');

    return this.prisma.departamento.create({
      data: { organizationId, nombre: input.nombre },
    });
  }

  async eliminarDepartamento(organizationId: string, id: string) {
    const dep = await this.prisma.departamento.findFirst({ where: { id, organizationId } });
    if (!dep) throw new BadRequestException('El departamento no existe en esta organización');
    await this.prisma.departamento.delete({ where: { id } });
    return { ok: true };
  }

  // ── Sucursales (ubicación física) ──────────────────────────────
  listarSucursales(organizationId: string) {
    return this.prisma.sucursal.findMany({
      where: { organizationId },
      include: { _count: { select: { leads: true, miembros: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async actualizarSucursal(organizationId: string, id: string, input: ActualizarSucursalInput) {
    const suc = await this.prisma.sucursal.findFirst({ where: { id, organizationId } });
    if (!suc) throw new BadRequestException('La agencia no existe en esta organización');
    if (input.nombre && input.nombre !== suc.nombre) {
      const repetida = await this.prisma.sucursal.findUnique({
        where: { organizationId_nombre: { organizationId, nombre: input.nombre } },
      });
      if (repetida) throw new ConflictException('Ya existe una agencia con ese nombre');
    }
    return this.prisma.sucursal.update({
      where: { id },
      data: { nombre: input.nombre, ciudad: input.ciudad === undefined ? undefined : input.ciudad || null },
    });
  }

  async crearSucursal(organizationId: string, input: SucursalInput) {
    const existe = await this.prisma.sucursal.findUnique({
      where: { organizationId_nombre: { organizationId, nombre: input.nombre } },
    });
    if (existe) throw new ConflictException('Ya existe una sucursal con ese nombre');

    return this.prisma.sucursal.create({
      data: { organizationId, nombre: input.nombre, ciudad: input.ciudad || null },
    });
  }

  async eliminarSucursal(organizationId: string, id: string) {
    const suc = await this.prisma.sucursal.findFirst({ where: { id, organizationId } });
    if (!suc) throw new BadRequestException('La sucursal no existe en esta organización');
    await this.prisma.sucursal.delete({ where: { id } });
    return { ok: true };
  }
}
