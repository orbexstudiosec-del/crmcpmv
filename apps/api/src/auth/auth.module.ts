import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenancyGuard } from './guards/tenancy.guard';
import { authSecret } from '../common/secretos';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: authSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtAuthGuard, TenancyGuard, MailService],
  exports: [JwtModule, JwtAuthGuard, TenancyGuard, PrismaService, AuthService, MailService],
})
export class AuthModule {}
