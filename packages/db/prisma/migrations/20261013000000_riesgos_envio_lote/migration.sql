-- AlterTable
ALTER TABLE "AnalisisRiesgo" ADD COLUMN     "enviadoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "umbralLoteRiesgo" INTEGER NOT NULL DEFAULT 10;

