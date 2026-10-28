-- Cronopost: categorías configurables (Crédito, Inversiones, Seguridad…) en cada publicación.
-- Reemplazan a los "pilares de contenido" de la configuración de IA: los pilares que ya existían
-- se convierten en categorías antes de borrar la columna.

-- CreateTable
CREATE TABLE "CategoriaCronopost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2a78d6',
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaCronopost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoriaCronopost_organizationId_idx" ON "CategoriaCronopost"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaCronopost_organizationId_nombre_key" ON "CategoriaCronopost"("organizationId", "nombre");

-- AddForeignKey
ALTER TABLE "CategoriaCronopost" ADD CONSTRAINT "CategoriaCronopost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Categorías iniciales para cada organización existente.
INSERT INTO "CategoriaCronopost" ("id", "organizationId", "nombre", "color", "descripcion", "orden")
SELECT gen_random_uuid()::text, o."id", c.nombre, c.color, c.descripcion, c.orden
FROM "Organization" o
CROSS JOIN (VALUES
  ('Crédito', '#2a78d6', 'Productos de crédito: consumo, microcrédito, vivienda; requisitos y beneficios.', 1),
  ('Inversiones', '#16a34a', 'Ahorro e inversión: depósitos a plazo fijo, ahorro programado, rendimientos.', 2),
  ('Seguridad', '#e0433d', 'Prevención de estafas y fraudes, cuidado de claves y canales oficiales.', 3),
  ('Educación financiera', '#7c5cfc', 'Consejos prácticos de presupuesto, ahorro y manejo de deudas.', 4),
  ('Institucional', '#eda100', 'Noticias, aniversarios, agencias, comunidad y responsabilidad social.', 5)
) AS c(nombre, color, descripcion, orden)
ON CONFLICT ("organizationId", "nombre") DO NOTHING;

-- Los pilares de contenido que ya se habían configurado pasan a ser categorías.
INSERT INTO "CategoriaCronopost" ("id", "organizationId", "nombre", "color", "orden")
SELECT gen_random_uuid()::text, cfg."organizationId", p.pilar, '#64748b', 100 + p.n
FROM "CronopostConfig" cfg
CROSS JOIN LATERAL unnest(cfg."pilares") WITH ORDINALITY AS p(pilar, n)
WHERE trim(p.pilar) <> ''
ON CONFLICT ("organizationId", "nombre") DO NOTHING;

-- AlterTable
ALTER TABLE "CronopostConfig" DROP COLUMN "pilares";

-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN     "categoriaId" TEXT;

-- CreateIndex
CREATE INDEX "Publicacion_categoriaId_idx" ON "Publicacion"("categoriaId");

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaCronopost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
