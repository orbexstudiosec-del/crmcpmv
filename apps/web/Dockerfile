# Build del frontend Next.js dentro del monorepo pnpm.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# Ver nota en apps/api/Dockerfile sobre --ignore-scripts.
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @totalcrm/shared build
# Sin variables NEXT_PUBLIC_*: el navegador llama a /api en el mismo origen y la marca se lee
# en runtime, así que la imagen no queda atada al dominio ni al nombre de una instalación.
RUN pnpm --filter @totalcrm/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
# Con node directo (no pnpm): el arranque no depende de que corepack descargue pnpm.
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
