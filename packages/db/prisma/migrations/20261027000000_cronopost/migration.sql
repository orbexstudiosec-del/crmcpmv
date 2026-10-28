-- Cronopost: cronograma de publicaciones en redes sociales (planificación del equipo de marketing).

-- CreateEnum
CREATE TYPE "RedSocial" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'LINKEDIN', 'YOUTUBE', 'X');

-- CreateEnum
CREATE TYPE "TipoPieza" AS ENUM ('IMAGEN', 'CARRUSEL', 'REEL', 'HISTORIA', 'VIDEO', 'TEXTO');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('IDEA', 'DISENO', 'REVISION', 'APROBADO', 'PUBLICADO');

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "redes" "RedSocial"[],
    "tipo" "TipoPieza" NOT NULL DEFAULT 'IMAGEN',
    "tema" TEXT NOT NULL,
    "copy" TEXT,
    "hashtags" TEXT,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'IDEA',
    "responsableId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Publicacion_organizationId_fecha_idx" ON "Publicacion"("organizationId", "fecha");

-- CreateIndex
CREATE INDEX "Publicacion_responsableId_idx" ON "Publicacion"("responsableId");

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

