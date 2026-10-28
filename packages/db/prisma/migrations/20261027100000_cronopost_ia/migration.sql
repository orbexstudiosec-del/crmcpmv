-- Cronopost: configuración de la IA (voz de la marca y reglas para generar el plan semanal o mensual).

-- CreateTable
CREATE TABLE "CronopostConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "descripcion" TEXT,
    "publicoObjetivo" TEXT,
    "productos" TEXT,
    "pilares" TEXT[],
    "tono" TEXT NOT NULL DEFAULT 'CERCANO',
    "redes" "RedSocial"[],
    "publicacionesPorSemana" INTEGER NOT NULL DEFAULT 3,
    "dias" TEXT[],
    "horarios" TEXT[],
    "hashtagsFijos" TEXT,
    "restricciones" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronopostConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronopostConfig_organizationId_key" ON "CronopostConfig"("organizationId");

-- AddForeignKey
ALTER TABLE "CronopostConfig" ADD CONSTRAINT "CronopostConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

