-- Acceso por correo institucional: la cuenta se activa con un enlace enviado al correo (mismo
-- token que "olvidé mi contraseña") y cada inicio de sesión pide un código enviado al correo.
-- La verificación por enlace separada deja de existir: activar la cuenta ya prueba el buzón.

-- DropForeignKey
ALTER TABLE "EmailVerificationToken" DROP CONSTRAINT "EmailVerificationToken_userId_fkey";

-- DropTable
DROP TABLE "EmailVerificationToken";

-- CreateTable
CREATE TABLE "CodigoAcceso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodigoAcceso_userId_idx" ON "CodigoAcceso"("userId");

-- AddForeignKey
ALTER TABLE "CodigoAcceso" ADD CONSTRAINT "CodigoAcceso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
