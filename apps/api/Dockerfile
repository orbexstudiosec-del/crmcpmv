# Build del API NestJS dentro del monorepo pnpm.
FROM node:22-alpine AS base
# openssl: lo necesita el motor de Prisma en Alpine.
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# --ignore-scripts: los postinstall no hacen falta — prisma generate se invoca directo en el
# build de @totalcrm/db de abajo, y esbuild ya trae su binario resuelto por plataforma.
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @totalcrm/shared build
# `prisma generate` (parte del build de @totalcrm/db) valida el schema y necesita que
# DATABASE_URL exista — no se conecta a la base en este paso, así que un valor
# placeholder alcanza. La URL real se inyecta en runtime desde docker-compose.yml.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" pnpm --filter @totalcrm/db build
RUN pnpm --filter @totalcrm/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
# Aplica las migraciones pendientes antes de arrancar: instalar y actualizar son el mismo
# comando (`docker compose up -d --build`), sin pasos manuales sobre la base. Se invoca el
# binario de Prisma con node (no con pnpm) para que el arranque no dependa de que corepack
# pueda descargar pnpm en ese momento.
CMD ["sh", "-c", "node ../../packages/db/node_modules/prisma/build/index.js migrate deploy --schema ../../packages/db/prisma/schema.prisma && node dist/main.js"]
