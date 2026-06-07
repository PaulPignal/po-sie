# syntax=docker/dockerfile:1
# Image Node 22 (requise par node:sqlite). `pnpm start` exécute le serveur via tsx
# et sert aussi le front compilé (apps/web/dist) — un seul process, un seul port.
FROM node:22-slim
WORKDIR /app

ENV HOST=0.0.0.0 \
    PORT=3001 \
    DATA_DIR=/app/data

RUN corepack enable

# Installe les deps (dont tsx/vite/tsup, nécessaires au build et au runtime) en
# profitant du cache tant que les manifestes ne changent pas.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# La base SQLite vit dans le volume (sinon elle disparaît à chaque redéploiement).
VOLUME ["/app/data"]
EXPOSE 3001

CMD ["pnpm", "start"]
