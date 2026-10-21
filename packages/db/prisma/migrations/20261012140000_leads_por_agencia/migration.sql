-- AlterEnum
ALTER TYPE "CampoLeadFijo" ADD VALUE 'CIUDAD';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "sucursalId" TEXT;

-- AlterTable
ALTER TABLE "Sucursal" ADD COLUMN     "ciudad" TEXT;

-- CreateIndex
CREATE INDEX "Lead_sucursalId_idx" ON "Lead"("sucursalId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

