-- API key de OpenAI configurable desde la pantalla de Configuración (cifrada, una por organización).

-- CreateTable
CREATE TABLE "ConfiguracionIA" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKeyCifrada" BYTEA NOT NULL,
    "apiKeyIv" BYTEA NOT NULL,
    "apiKeyTag" BYTEA NOT NULL,
    "apiKeyFinal" TEXT NOT NULL,
    "modelo" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionIA_organizationId_key" ON "ConfiguracionIA"("organizationId");

-- AddForeignKey
ALTER TABLE "ConfiguracionIA" ADD CONSTRAINT "ConfiguracionIA_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

