# OffersKatta API

The shared NestJS backend for [OffersKatta](https://github.com/GovindDharne/OffersKatta) — serves the website, admin panel, customer mobile app, and seller mobile app. This repo is a self-contained pnpm workspace: the NestJS app plus the two shared TypeScript packages it depends on.

## What's inside

```
.
├── apps/
│   └── api/                     NestJS 10 backend
│       ├── prisma/              Prisma schema + migrations + seed scripts
│       ├── src/                 NestJS modules (auth, offers, redemptions, payments, …)
│       └── test/                Jest e2e tests
└── packages/
    ├── shared/                  Enums, types, constants, permissions (zod-validated)
    └── config/                  Shared TSConfig + ESLint presets
```

The two packages under `packages/` are referenced from `apps/api` via pnpm's `workspace:*` protocol.

## Tech stack

- **NestJS 10** + **TypeScript 5** strict
- **Prisma 5** + **PostgreSQL** (PostGIS extension for geo queries)
- **Redis** (cache + BullMQ job queue)
- **JWT** auth (`@nestjs/jwt` + Passport) with refresh tokens
- **Firebase Admin** for Google / phone sign-in token verification + FCM push
- **Razorpay** for subscriptions and offer-boost payments
- **Cloudinary** for image uploads
- **Nodemailer** for transactional email
- **Swagger** docs at `/api/docs`

## Prerequisites

- **Node.js ≥ 20.11**
- **pnpm ≥ 9** (`npm i -g pnpm`)
- **PostgreSQL 15+** (with PostGIS) running locally or reachable
- **Redis 7+** running locally or reachable
- Or just **Docker** + the per-app Dockerfile if you don't want to install Postgres/Redis natively

## Quick start (local without Docker)

```bash
# 1. Install
pnpm install

# 2. Environment
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — set DATABASE_URL, REDIS_URL, JWT secrets, etc.

# 3. Generate Prisma client + run migrations
pnpm db:generate
pnpm db:migrate

# 4. (Optional) Seed with categories, banks, sample admin user, etc.
pnpm db:seed

# 5. Run
pnpm dev                       # NestJS in watch mode on :4000
# Swagger UI at http://localhost:4000/api/docs
```

## Quick start (Docker — recommended for a clean baseline)

The repo ships `apps/api/Dockerfile` (prod) and `apps/api/Dockerfile.dev` (with hot-reload). To use them you'll want a compose file that also brings up Postgres + Redis — that lives outside this repo (in the parent monorepo). If you want a Postgres+Redis+API compose file dropped into this repo, ask.

## Environment variables

All variables live in `apps/api/.env`. The example file (`apps/api/.env.example`) documents every key. Categories:

| Group | Keys | Notes |
|---|---|---|
| **App** | `NODE_ENV`, `PORT`, `CORS_ORIGINS` | `PORT` defaults to 4000 |
| **Database** | `DATABASE_URL` | Postgres connection string. Prisma needs `?schema=public`. |
| **Redis** | `REDIS_URL`, `REDIS_TTL` | Used for caching + BullMQ |
| **JWT** | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Use long random strings in prod |
| **Firebase Admin** | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | From a service-account JSON downloaded from Firebase Console |
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard → Settings → API Keys / Webhooks |
| **Cloudinary** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | For image uploads |
| **SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | For password reset, lead notifications |

**Never commit `.env`** — it's gitignored. Only `.env.example` goes in the repo. Firebase service-account JSONs (`*firebase-adminsdk*.json`) are also gitignored as a belt-and-suspenders measure.

## Common tasks

```bash
pnpm dev                # watch mode on :4000
pnpm build              # build to apps/api/dist
pnpm start:prod         # run the built bundle
pnpm test               # unit tests (jest)
pnpm test:e2e           # e2e tests (jest --config test/jest-e2e.json)
pnpm lint
pnpm typecheck

# Prisma
pnpm db:generate        # regenerate Prisma client after schema changes
pnpm db:migrate         # create + apply a new dev migration
pnpm db:migrate:deploy  # apply pending migrations in prod
pnpm db:reset           # WIPES DB and re-applies all migrations + seed
pnpm db:seed            # populate categories, banks, malls, sample admin
pnpm db:studio          # Prisma Studio at http://localhost:5555
```

## API surface

Browse the live OpenAPI docs at `/api/docs` once the server is running. Notable modules:

| Path prefix | What it does |
|---|---|
| `/api/auth/*` | Email+password, Firebase token, phone OTP login + register |
| `/api/users/me` | Current user profile |
| `/api/brands`, `/api/branches` | Multi-tenant brand + branch CRUD |
| `/api/offers`, `/api/offers/:id` | Offer CRUD + public listing |
| `/api/offers/nearby` | Geo-radius search using PostGIS |
| `/api/redemptions/*` | Issue (customer) + confirm/cancel (staff) redemptions |
| `/api/subscriptions/*`, `/api/payments/*` | Razorpay-backed subscription + boost flows |
| `/api/categories`, `/api/banks`, `/api/cities`, `/api/states`, `/api/malls` | Catalog data used by clients |
| `/api/uploads/*` | File upload proxy to Cloudinary |
| `/api/notifications/*`, `/api/push/*` | In-app notifications + FCM push |

## How this repo relates to the monorepo

Split out of [GovindDharne/OffersKatta](https://github.com/GovindDharne/OffersKatta). The two shared packages (`packages/shared`, `packages/config`) are **copies** of the upstream versions. Changes to those packages must be synced back to the monorepo manually until / unless they're published to npm.

## License

Proprietary — see the parent OffersKatta repo.
