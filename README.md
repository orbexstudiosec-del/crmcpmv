# TotalCRM

CRM omnicanal que se instala en el servidor de cada empresa. Una instalación = una empresa,
con su propia base de datos y su propia marca: el nombre del CRM se elige en el instalador y
después se cambia (junto con el logo y el color) desde **Configuración → Marca**.

## Qué incluye

- **Bandeja de mensajes** unificada con asignación, notas internas, estados y vínculo a
  leads, clientes y etapas del embudo.
- **WhatsApp Business por la API oficial** (Meta Cloud API): texto, botones y listas, y
  campañas con plantillas aprobadas. La conexión por código QR no está autorizada para uso
  institucional y se retiró. El envío de adjuntos y notas de voz, y abrir los adjuntos
  recibidos, todavía no están implementados por la API oficial.
- **CRM**: leads, oportunidades en Kanban con embudo configurable, actividades, calendario,
  clientes y reportes.
- **Bots** con editor visual, **campañas** de WhatsApp y **formularios** públicos de
  captación de leads.
- **Cronopost**: cronograma mensual de publicaciones en redes sociales (fecha y hora,
  categoría, redes, tipo de pieza, copy, hashtags, estado y responsable) con exportación a
  Excel. Las **categorías** (Crédito, Inversiones, Seguridad…) son configurables: nombre, color
  y descripción. Con IA (opcional; la API key de OpenAI se carga en **Configuración →
  Inteligencia artificial**, cifrada): propuestas de copy y generación del plan completo de una
  semana o un mes según la configuración del Cronopost (categorías a repartir, voz de la marca,
  redes, días y horarios). Es planificación: no publica en las redes.
- **Acceso con el correo institucional**: la cuenta se activa con un enlace enviado al correo
  y cada inicio de sesión pide además un código que llega a ese correo (doble factor).
- **Equipo** con roles (propietario, administrador, supervisor, agente, riesgos, gerencia).
  Los permisos de cada rol los aplica el API, no solo la interfaz.
- **Riesgos**: análisis y aprobación de prospectos, con envío por lotes a los jefes de agencia.

Instagram, Messenger y TikTok ya se pueden conectar y validar desde Configuración, pero
todavía no reciben ni envían mensajes; los comentarios de redes tampoco están implementados.

## Stack

- **Monorepo:** pnpm + Turborepo
- **Web:** Next.js 16 (App Router) + React 19 + Tailwind 4
- **API:** NestJS 11 (Node 22)
- **Datos:** PostgreSQL 16 + Prisma
- **Infra:** Docker Compose + Caddy (HTTPS automático)

```
apps/
  web/   Interfaz
  api/   Backend REST
packages/
  db/      Esquema Prisma, migraciones y cliente
  shared/  Validadores y tipos (zod) compartidos entre web y API
infra/     Caddyfile, init de Postgres y guía de instalación
install.sh Instalador para el servidor del cliente
```

## Instalar en un servidor

```bash
./install.sh
```

Pregunta el nombre del CRM, la empresa, el dominio y el administrador; genera las claves y
levanta todo. Detalle en [infra/DEPLOY.md](infra/DEPLOY.md).

## Desarrollo local

Requiere Node 22+, pnpm (vía `corepack`) y un PostgreSQL con una base vacía.

```bash
corepack pnpm install
cp .env.example .env            # ajusta DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY y ADMIN_*
corepack pnpm --filter "./packages/*" build
corepack pnpm db:migrate        # crea las tablas

# En dos terminales
corepack pnpm --filter @totalcrm/api dev                       # API → http://localhost:4000/api
node apps/web/node_modules/next/dist/bin/next dev apps/web     # Web → http://localhost:3000
```

En el primer arranque el API crea la empresa y el administrador con `COMPANY_NAME` y
`ADMIN_*` del `.env`. No hay registro público: el resto de usuarios se crea desde **Equipo**.

La web llama siempre a `/api` en su mismo origen; en desarrollo un rewrite de Next lo lleva
al API en `:4000` (variable `API_INTERNAL_URL`).

## Seguridad

- `AUTH_SECRET` no tiene valor por defecto: sin él el API no arranca.
- Las credenciales de los canales se guardan cifradas (AES-256-GCM) con `ENCRYPTION_KEY`.
- Los webhooks llevan un secreto en la URL; el de Meta valida además la firma
  `X-Hub-Signature-256` cuando la integración tiene configurado el App Secret.
