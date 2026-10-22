-- Se retira WhatsApp por código QR (Evolution API): no está autorizado para uso institucional.
-- WhatsApp queda solo por la API oficial de Meta (WHATSAPP_API).
BEGIN;

-- Datos del canal QR. Las conversaciones se llevan en cascada sus mensajes, notas y
-- ejecuciones de bot; las actividades vinculadas quedan sin conversación (ON DELETE SET NULL).
DELETE FROM "IntegracionCanal" WHERE "canal" = 'WHATSAPP_QR';
DELETE FROM "Conversacion" WHERE "canal" = 'WHATSAPP_QR';
UPDATE "BotFlow" SET "canal" = NULL WHERE "canal" = 'WHATSAPP_QR';
UPDATE "Campana" SET "canalWhatsapp" = 'WHATSAPP_API' WHERE "canalWhatsapp" = 'WHATSAPP_QR';

-- AlterEnum
CREATE TYPE "CanalMensajeria_new" AS ENUM ('WHATSAPP_API', 'MESSENGER', 'INSTAGRAM', 'TIKTOK');
ALTER TABLE "Campana" ALTER COLUMN "canalWhatsapp" TYPE "CanalMensajeria_new" USING ("canalWhatsapp"::text::"CanalMensajeria_new");
ALTER TABLE "IntegracionCanal" ALTER COLUMN "canal" TYPE "CanalMensajeria_new" USING ("canal"::text::"CanalMensajeria_new");
ALTER TABLE "Conversacion" ALTER COLUMN "canal" TYPE "CanalMensajeria_new" USING ("canal"::text::"CanalMensajeria_new");
ALTER TABLE "BotFlow" ALTER COLUMN "canal" TYPE "CanalMensajeria_new" USING ("canal"::text::"CanalMensajeria_new");
ALTER TYPE "CanalMensajeria" RENAME TO "CanalMensajeria_old";
ALTER TYPE "CanalMensajeria_new" RENAME TO "CanalMensajeria";
DROP TYPE "public"."CanalMensajeria_old";

-- Referencia interna de Evolution para volver a pedir adjuntos; ya no se usa.
ALTER TABLE "Mensaje" DROP COLUMN "remoteJid";

COMMIT;
