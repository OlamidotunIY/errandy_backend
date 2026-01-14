# ==============================================================================
# Dockerfile for NestJS Backend
# ==============================================================================
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./

RUN npm ci

# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema=prisma/model

# Run build and verify output exists
RUN npm run build && \
    ls -la dist/ && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found!" && exit 1)

RUN npm prune --production

# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/errandy-480815-firebase-adminsdk-fbsvc-4e860235e5.json ./

USER nestjs
EXPOSE 3500

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3500/health || exit 1

CMD ["node", "dist/main.js"]
