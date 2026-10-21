import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
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

  async agregarMiembro(organizationId: string, input: MiembroInput, actorRol: RolMiembro) {
    exigirGestionDeOwner(actorRol, input.rol === 'OWNER', 'Solo el propietario puede crear otra cuenta de propietario.');
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
      const passwordHash = await bcrypt.hash(input.password, 10);
      user = await this.prisma.user.create({
        data: { nombre: input.nombre, email: input.email, passwordHash },
      });
      // A diferencia del auto-registro público, agregar un miembro acá no mandaba ningún correo:
      // quedaba con emailVerified=null para siempre, bloqueado en login() sin que nadie se
      // enterara. reenviarVerificacion ya trae su propio guard (no reenvía si ya está verificado).
      await this.authService.reenviarVerificacion(user.email);
    }

    return this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        rol: input.rol,
        departamentoId: input.departamentoId ?? null,
        sucursalId: input.sucursalId ?? null,
      },
      select: MIEMBRO_SELECT,
    });
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
    if (input.nombre !== undefined || input.email !== undefined) {
      if (input.email) {
        const existente = await this.prisma.user.findUnique({ where: { email: input.email } });
        if (existente && existente.id !== miembro.userId) {
          throw new ConflictException('Ya existe un usuario con ese correo');
        }
      }
      await this.prisma.user.update({
        where: { id: miembro.userId },
        data: { nombre: input.nombre, email: input.email },
      });
    }

    return this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        rol: input.rol,
        departamentoId: input.departamentoId === undefined ? undefined : input.departamentoId,
        sucursalId: input.sucursalId === undefined ? undefined : input.sucursalId,
      },
      select: MIEMBRO_SELECT,
    });
  }

  /** Los miembros agregados por un admin (agregarMiembro) nunca reciben el correo de
   *  verificación que sí dispara el auto-registro público — quedarían bloqueados en login()
   *  (exige emailVerified) para siempre si nadie los verifica. Esto le da al OWNER/ADMIN una
   *  salida manual, sin depender de que llegue un correo (SMTP puede no estar configurado). */
  async verificarEmail(organizationId: string, membershipId: string) {
    const miembro = await this.prisma.membership.findFirst({ where: { id: membershipId, organizationId } });
    if (!miembro) throw new BadRequestException('El miembro no existe en esta organización');
    await this.prisma.user.update({ where: { id: miembro.userId }, data: { emailVerified: new Date() } });
    return this.prisma.membership.findUniqueOrThrow({ where: { id: membershipId }, select: MIEMBRO_SELECT });
  }

  /** Vía "sana" para desatascar a alguien sin verificar: reenvía el mismo correo con el enlace
   *  (en vez de saltárselo con verificarEmail). reenviarVerificacion ya no hace nada si el
   *  usuario ya está verificado, así que es seguro repetir el click. */
  async reenviarVerificacion(organizationId: string, membershipId: string) {
    const miembro = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: { select: { email: true } } },
    });
    if (!miembro) throw new BadRequestException('El miembro no existe en esta organización');
    return this.authService.reenviarVerificacion(miembro.user.email);
  }

  /** Le manda al miembro el mismo correo de "olvidé mi contraseña" que dispararía él mismo —
   *  para cuando perdió la temporal que le dio el admin al crearlo, o quiere una nueva. No
   *  depende de que esté verificado (son cosas independientes). */
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
