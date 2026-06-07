# OffersKatta Website

The public customer-facing website for [OffersKatta](https://github.com/GovindDharne/OffersKatta) — a multi-tenant promotional offers platform. This repo is a self-contained pnpm workspace: the Next.js website plus the three shared TypeScript packages it depends on.

## What's inside

```
.
├── apps/
│   └── web/                     Next.js 14 public site
└── packages/
    ├── shared/                  Enums, types, constants, permissions (TS, depends on zod)
    ├── ui/                      Shared UI primitives (cva / tailwind-merge)
    └── config/                  Shared TSConfig + ESLint presets
```

The three packages under `packages/` are referenced from `apps/web` via pnpm's `workspace:*` protocol — that's why this is a workspace, not a single-package project.

## Tech stack

- **Next.js 14** (App Router, React 18)
- **TypeScript 5** strict
- **Tailwind CSS** + Radix UI primitives + lucide-react icons
- **TanStack React Query** for server state
- **react-hook-form** + **Zod** for forms
- **axios** for HTTP, **react-leaflet** for "offers near me" maps
- **Sonner** for toasts
- **Playwright** for end-to-end tests

## Prerequisites

- **Node.js ≥ 20.11**
- **pnpm ≥ 9** (`npm i -g pnpm` if missing)
- A reachable **OffersKatta API** for runtime — the site is a client; it doesn't run the backend.

## Quick start

```bash
pnpm install

cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local — at minimum set NEXT_PUBLIC_API_URL.

pnpm dev
# open http://localhost:3000
```

## Environment variables

Documented in `apps/web/.env.example`. The important ones:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_API_URL` | Public-facing API base URL, e.g. `https://api.offerskatta.com/api` or `http://localhost/api` |
| `NEXT_PUBLIC_API_URL_INTERNAL` | Server-side API URL used by Next rewrites inside Docker (`http://api:4000`) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase config for Google / phone login |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay publishable key for Subscription / Boost flows |

**Never commit `.env.local`** — it's gitignored. Only `.env.example` belongs in the repo.

## Common tasks

```bash
pnpm dev                # http://localhost:3000
pnpm build              # production build
pnpm start              # serve production build
pnpm lint               # eslint across all workspace packages
pnpm typecheck          # tsc --noEmit across all packages
pnpm test:e2e           # Playwright end-to-end tests
pnpm --filter @offerhub/web test:e2e:install   # first-time browser install
pnpm format             # prettier --write
```

## Docker

`apps/web/Dockerfile` and `apps/web/Dockerfile.dev` ship in the repo. They're intended to plug into a top-level `docker-compose` that also runs the API; if you want a compose stack for this repo standalone, ask.

## Project layout (`apps/web/src`)

| Path | What it is |
|---|---|
| `app/` | Next.js App Router pages — `app/offers/[id]`, `app/search`, `app/login`, etc. |
| `components/` | App-specific React components and shadcn-style primitives under `ui/` |
| `lib/` | Cross-cutting helpers — `api.ts` (axios), `auth-context.tsx`, `utils.ts` |
| `hooks/` | Custom React hooks |

## How this repo relates to the monorepo

This repo was split out of [GovindDharne/OffersKatta](https://github.com/GovindDharne/OffersKatta). The shared packages (`packages/shared`, `packages/ui`, `packages/config`) are **copies** of the upstream versions. Treat the monorepo as the source of truth for cross-cutting changes (DTOs, enums) until / unless those packages are published to npm.

## License

Proprietary — see the parent OffersKatta repo.
