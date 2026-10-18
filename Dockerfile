# ==============================================================================
# Dockerfile for Errandy NestJS Backend (API + BullMQ Worker)
# ==============================================================================
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema=prisma/model

# Run build and verify both API and Worker entrypoints exist
RUN pnpm run build && \
    ls -la dist/ && \
    test -f dist/src/main.js || (echo "ERROR: dist/src/main.js not found!" && exit 1) && \
    test -f dist/src/worker.js || (echo "ERROR: dist/src/worker.js not found!" && exit 1)

RUN CI=true pnpm prune --prod

# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    mkdir -p /app/infrastructure/Firebase && \
    chown -R nestjs:nodejs /app/infrastructure

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD sh -c 'wget --no-verbose --tries=1 --spider "http://localhost:${PORT:-8080}/health" || exit 1'

CMD ["node", "dist/src/main.js"]
