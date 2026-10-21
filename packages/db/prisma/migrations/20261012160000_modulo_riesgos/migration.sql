-- CreateEnum
CREATE TYPE "EstadoRiesgo" AS ENUM ('PENDIENTE', 'EN_ANALISIS', 'APROBADO', 'RECHAZADO', 'OBSERVADO');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'RIESGOS';

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'RIESGO_APROBADO';

-- CreateTable
CREATE TABLE "AnalisisRiesgo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estado" "EstadoRiesgo" NOT NULL DEFAULT 'PENDIENTE',
    "nivel" "NivelRiesgo",
    "puntaje" INTEGER,
    "montoSolicitado" DECIMAL(14,2),
    "montoAprobado" DECIMAL(14,2),
    "ingresos" DECIMAL(14,2),
    "egresos" DECIMAL(14,2),
    "criterios" JSONB,
    "observaciones" TEXT,
    "analizadoPorId" TEXT,
    "analizadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalisisRiesgo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalisisRiesgo_leadId_key" ON "AnalisisRiesgo"("leadId");

-- CreateIndex
CREATE INDEX "AnalisisRiesgo_organizationId_estado_idx" ON "AnalisisRiesgo"("organizationId", "estado");

-- CreateIndex
CREATE INDEX "AnalisisRiesgo_analizadoPorId_idx" ON "AnalisisRiesgo"("analizadoPorId");

-- AddForeignKey
ALTER TABLE "AnalisisRiesgo" ADD CONSTRAINT "AnalisisRiesgo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalisisRiesgo" ADD CONSTRAINT "AnalisisRiesgo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalisisRiesgo" ADD CONSTRAINT "AnalisisRiesgo_analizadoPorId_fkey" FOREIGN KEY ("analizadoPorId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

