-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('OWNER', 'ADMIN', 'SUPERVISOR', 'AGENTE', 'GERENCIA');

-- CreateEnum
CREATE TYPE "TipoIdentificacion" AS ENUM ('RUC', 'CEDULA', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'IDENTIFICACION_EXTERIOR');

-- CreateEnum
CREATE TYPE "LeadEstado" AS ENUM ('NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO', 'CONVERTIDO');

-- CreateEnum
CREATE TYPE "TipoCampoFormulario" AS ENUM ('TEXTO_CORTO', 'TEXTO_LARGO', 'TELEFONO', 'EMAIL', 'OPCION_UNICA', 'OPCION_MULTIPLE');

-- CreateEnum
CREATE TYPE "CampoLeadFijo" AS ENUM ('EMAIL', 'EMPRESA', 'NOTAS');

-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('LLAMADA', 'EMAIL', 'REUNION', 'TAREA', 'NOTA', 'VISITA');

-- CreateEnum
CREATE TYPE "CanalCampana" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "EstadoCampana" AS ENUM ('BORRADOR', 'PROGRAMADA', 'ENVIANDO', 'ENVIADA');

-- CreateEnum
CREATE TYPE "PublicoCampana" AS ENUM ('CLIENTES', 'LEADS', 'LEADS_FORMULARIO');

-- CreateEnum
CREATE TYPE "EstadoEnvioDestinatario" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR');

-- CreateEnum
CREATE TYPE "CanalMensajeria" AS ENUM ('WHATSAPP_QR', 'WHATSAPP_API', 'MESSENGER', 'INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "EstadoIntegracion" AS ENUM ('DESCONECTADO', 'PENDIENTE', 'CONECTADO', 'ERROR');

-- CreateEnum
CREATE TYPE "ConversacionEstado" AS ENUM ('ABIERTA', 'PENDIENTE', 'RESUELTA');

-- CreateEnum
CREATE TYPE "DireccionMensaje" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "TipoMensaje" AS ENUM ('TEXTO', 'IMAGEN', 'VIDEO', 'AUDIO', 'STICKER', 'DOCUMENTO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('LEAD_NUEVO', 'LEAD_CONVERTIDO', 'MENSAJE_NUEVO', 'BOT_ACTIVADO', 'CITA_AGENDADA');

-- CreateEnum
CREATE TYPE "TipoEsperaBot" AS ENUM ('INPUT', 'OPCION', 'AGENDA');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "etiquetasConversacion" JSONB,
    "pipelineEtapas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nombre" TEXT NOT NULL,
    "colorPrimario" TEXT,
    "logo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'AGENTE',
    "departamentoId" TEXT,
    "sucursalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tipoIdentificacion" "TipoIdentificacion" NOT NULL,
    "identificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "fuente" TEXT,
    "estado" "LeadEstado" NOT NULL DEFAULT 'NUEVO',
    "notas" TEXT,
    "formularioId" TEXT,
    "respuestasFormulario" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormularioLead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "mensajeExito" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormularioLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormularioLeadCampo" (
    "id" TEXT NOT NULL,
    "formularioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoCampoFormulario" NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "opciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mapeaA" "CampoLeadFijo",

    CONSTRAINT "FormularioLeadCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidad" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "clienteId" TEXT,
    "leadId" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'PROSPECTO',
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "probabilidad" INTEGER NOT NULL DEFAULT 0,
    "cierreEstimado" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oportunidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tipo" "TipoActividad" NOT NULL,
    "asunto" TEXT NOT NULL,
    "detalle" TEXT,
    "inicio" TIMESTAMP(3),
    "vencimiento" TIMESTAMP(3),
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" TEXT,
    "oportunidadId" TEXT,
    "leadId" TEXT,
    "conversacionId" TEXT,
    "realizadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campana" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "canal" "CanalCampana" NOT NULL DEFAULT 'EMAIL',
    "estado" "EstadoCampana" NOT NULL DEFAULT 'BORRADOR',
    "mensaje" TEXT,
    "publico" "PublicoCampana",
    "formularioLeadId" TEXT,
    "canalWhatsapp" "CanalMensajeria",
    "plantillaMeta" TEXT,
    "plantillaMetaIdioma" TEXT,
    "totalDestinatarios" INTEGER NOT NULL DEFAULT 0,
    "programadaPara" TIMESTAMP(3),
    "enviadaEn" TIMESTAMP(3),
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "aperturas" INTEGER NOT NULL DEFAULT 0,
    "respuestas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampanaDestinatario" (
    "id" TEXT NOT NULL,
    "campanaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "variables" JSONB,
    "estado" "EstadoEnvioDestinatario" NOT NULL DEFAULT 'PENDIENTE',
    "error" TEXT,
    "enviadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampanaDestinatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegracionCanal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "canal" "CanalMensajeria" NOT NULL,
    "estado" "EstadoIntegracion" NOT NULL DEFAULT 'DESCONECTADO',
    "etiqueta" TEXT,
    "configCifrada" BYTEA,
    "configIv" BYTEA,
    "configTag" BYTEA,
    "conectadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracionCanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "canal" "CanalMensajeria" NOT NULL,
    "contactoId" TEXT NOT NULL,
    "contactoNombre" TEXT,
    "fotoUrl" TEXT,
    "clienteId" TEXT,
    "leadId" TEXT,
    "estado" "ConversacionEstado" NOT NULL DEFAULT 'ABIERTA',
    "asignadoAId" TEXT,
    "ultimoMensajeEn" TIMESTAMP(3),
    "noLeidos" INTEGER NOT NULL DEFAULT 0,
    "botPausado" BOOLEAN NOT NULL DEFAULT false,
    "eliminadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaConversacion" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaConversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "direccion" "DireccionMensaje" NOT NULL,
    "tipo" "TipoMensaje" NOT NULL DEFAULT 'TEXTO',
    "contenido" TEXT NOT NULL,
    "remoteId" TEXT,
    "remoteJid" TEXT,
    "enviadoEn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotFlow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "canal" "CanalMensajeria",
    "definicion" JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT,
    "url" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotFlowRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "botFlowId" TEXT NOT NULL,
    "nodoActualId" TEXT,
    "esperando" "TipoEsperaBot",
    "variables" JSONB NOT NULL DEFAULT '{}',
    "opcionesPendientes" JSONB,
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotFlowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_departamentoId_idx" ON "Membership"("departamentoId");

-- CreateIndex
CREATE INDEX "Membership_sucursalId_idx" ON "Membership"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Departamento_organizationId_idx" ON "Departamento"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_organizationId_nombre_key" ON "Departamento"("organizationId", "nombre");

-- CreateIndex
CREATE INDEX "Sucursal_organizationId_idx" ON "Sucursal"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_organizationId_nombre_key" ON "Sucursal"("organizationId", "nombre");

-- CreateIndex
CREATE INDEX "Cliente_organizationId_idx" ON "Cliente"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_organizationId_identificacion_key" ON "Cliente"("organizationId", "identificacion");

-- CreateIndex
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_formularioId_idx" ON "Lead"("formularioId");

-- CreateIndex
CREATE UNIQUE INDEX "FormularioLead_slug_key" ON "FormularioLead"("slug");

-- CreateIndex
CREATE INDEX "FormularioLead_organizationId_idx" ON "FormularioLead"("organizationId");

-- CreateIndex
CREATE INDEX "FormularioLeadCampo_formularioId_idx" ON "FormularioLeadCampo"("formularioId");

-- CreateIndex
CREATE INDEX "Oportunidad_organizationId_etapa_idx" ON "Oportunidad"("organizationId", "etapa");

-- CreateIndex
CREATE INDEX "Actividad_organizationId_idx" ON "Actividad"("organizationId");

-- CreateIndex
CREATE INDEX "Actividad_leadId_idx" ON "Actividad"("leadId");

-- CreateIndex
CREATE INDEX "Actividad_realizadoPorId_idx" ON "Actividad"("realizadoPorId");

-- CreateIndex
CREATE INDEX "Actividad_conversacionId_idx" ON "Actividad"("conversacionId");

-- CreateIndex
CREATE INDEX "Campana_organizationId_idx" ON "Campana"("organizationId");

-- CreateIndex
CREATE INDEX "CampanaDestinatario_campanaId_idx" ON "CampanaDestinatario"("campanaId");

-- CreateIndex
CREATE INDEX "IntegracionCanal_organizationId_idx" ON "IntegracionCanal"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracionCanal_organizationId_canal_key" ON "IntegracionCanal"("organizationId", "canal");

-- CreateIndex
CREATE INDEX "Conversacion_organizationId_ultimoMensajeEn_idx" ON "Conversacion"("organizationId", "ultimoMensajeEn");

-- CreateIndex
CREATE INDEX "Conversacion_asignadoAId_idx" ON "Conversacion"("asignadoAId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversacion_organizationId_canal_contactoId_key" ON "Conversacion"("organizationId", "canal", "contactoId");

-- CreateIndex
CREATE INDEX "NotaConversacion_conversacionId_createdAt_idx" ON "NotaConversacion"("conversacionId", "createdAt");

-- CreateIndex
CREATE INDEX "Mensaje_conversacionId_enviadoEn_idx" ON "Mensaje"("conversacionId", "enviadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Mensaje_conversacionId_remoteId_key" ON "Mensaje"("conversacionId", "remoteId");

-- CreateIndex
CREATE INDEX "BotFlow_organizationId_activo_idx" ON "BotFlow"("organizationId", "activo");

-- CreateIndex
CREATE INDEX "Notificacion_organizationId_leida_idx" ON "Notificacion"("organizationId", "leida");

-- CreateIndex
CREATE INDEX "Notificacion_organizationId_createdAt_idx" ON "Notificacion"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BotFlowRun_conversacionId_key" ON "BotFlowRun"("conversacionId");

-- CreateIndex
CREATE INDEX "BotFlowRun_organizationId_idx" ON "BotFlowRun"("organizationId");

-- CreateIndex
CREATE INDEX "BotFlowRun_botFlowId_idx" ON "BotFlowRun"("botFlowId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Departamento" ADD CONSTRAINT "Departamento_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "FormularioLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormularioLead" ADD CONSTRAINT "FormularioLead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormularioLeadCampo" ADD CONSTRAINT "FormularioLeadCampo_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "FormularioLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campana" ADD CONSTRAINT "Campana_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campana" ADD CONSTRAINT "Campana_formularioLeadId_fkey" FOREIGN KEY ("formularioLeadId") REFERENCES "FormularioLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampanaDestinatario" ADD CONSTRAINT "CampanaDestinatario_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "Campana"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracionCanal" ADD CONSTRAINT "IntegracionCanal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaConversacion" ADD CONSTRAINT "NotaConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFlow" ADD CONSTRAINT "BotFlow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFlowRun" ADD CONSTRAINT "BotFlowRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFlowRun" ADD CONSTRAINT "BotFlowRun_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFlowRun" ADD CONSTRAINT "BotFlowRun_botFlowId_fkey" FOREIGN KEY ("botFlowId") REFERENCES "BotFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

