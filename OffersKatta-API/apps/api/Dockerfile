# ============================================================
# OffersKatta API — production multi-stage build
# ============================================================
ARG NODE_VERSION=20.11.0

# ---- Base ----
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- Dependencies layer (cached) ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
# Flat-hoist node_modules so the compiled app can require transitive deps
# (e.g. multer via @nestjs/platform-express) that it doesn't declare directly.
RUN echo 'shamefully-hoist=true' > .npmrc && (pnpm install --frozen-lockfile || pnpm install)

# ---- Builder ----
FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /repo/apps/api
RUN pnpm exec prisma generate
RUN pnpm build

# ---- Runner ----
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S app && adduser -S app -G app

# Mirror the repo layout (/app/apps/api/...) so pnpm's relative symlinks
# in apps/api/node_modules resolve against /app/node_modules/.pnpm.
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /repo/packages ./packages

USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
