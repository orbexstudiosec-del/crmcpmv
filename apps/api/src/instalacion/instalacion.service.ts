import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { nombreMarcaInicial } from '../marca/marca.service';

/** Primera puesta en marcha. Cada instalación es de UNA empresa: no hay registro público, así
 * que la empresa y su administrador se crean aquí, una sola vez, con los datos que el
 * instalador dejó en el .env (COMPANY_NAME, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, APP_NAME).
 * Si ya existe una organización no toca nada: cambiar esas variables después no pisa datos. */
@Injectable()
export class InstalacionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InstalacionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.marca.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', nombre: nombreMarcaInicial() },
      update: {},
    });

    if ((await this.prisma.organization.count()) > 0) return;

    const email = process.env.ADMIN_EMAIL?.trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      this.logger.warn('No hay empresa creada y faltan ADMIN_EMAIL / ADMIN_PASSWORD: nadie podrá iniciar sesión. Defínelas en el .env y reinicia el API.');
      return;
    }
    if (password.length < 8) {
      this.logger.error('ADMIN_PASSWORD debe tener al menos 8 caracteres. No se creó el administrador.');
      return;
    }

    const empresa = process.env.COMPANY_NAME?.trim() || nombreMarcaInicial();
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.organization.create({
      data: {
        slug: 'principal',
        nombre: empresa,
        memberships: {
          create: {
            rol: 'OWNER',
            user: {
              connectOrCreate: {
                where: { email },
                // Verificado de entrada: el instalador ya confirmó quién es, y sin SMTP
                // configurado el correo de verificación nunca le llegaría.
                create: { email, nombre: process.env.ADMIN_NAME?.trim() || 'Administrador', passwordHash, emailVerified: new Date() },
              },
            },
          },
        },
      },
    });
    this.logger.log(`Instalación inicial lista: empresa "${empresa}", administrador ${email}.`);
  }
}
