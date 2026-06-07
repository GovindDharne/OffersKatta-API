# OffersKatta Admin

The admin / seller panel for [OffersKatta](https://github.com/GovindDharne/OffersKatta) — a multi-tenant promotional offers platform. This repo contains the Next.js admin app plus the three shared TypeScript packages it depends on, packaged as a self-contained pnpm workspace.

## What's inside

```
.
├── apps/
│   └── admin/                   Next.js 14 admin panel
└── packages/
    ├── shared/                  Enums, types, constants, permissions (TS, depends on zod)
    ├── ui/                      Shared UI primitives (cva / tailwind-merge)
    └── config/                  Shared TSConfig + ESLint presets
```

The three packages under `packages/` are referenced from `apps/admin` via pnpm's `workspace:*` protocol — that's why this repo is a workspace, not a single-package project.

## Tech stack

- **Next.js 14** (App Router, React 18)
- **TypeScript 5** strict mode
- **Tailwind CSS** + Radix UI primitives + lucide-react icons
- **TanStack React Query** for server state
- **react-hook-form** + **Zod** for form validation
- **axios** for HTTP, **leaflet** for branch maps
- **Sonner** for toasts

## Prerequisites

- **Node.js ≥ 20.11** (`node --version`)
- **pnpm ≥ 9** (`pnpm --version`, install via `npm i -g pnpm` if missing)
- A reachable **OffersKatta API** (the admin panel is a client; it doesn't run the backend itself). For local dev you can either point at a hosted API or run the API repo separately.

## Quick start

```bash
# 1. Install dependencies (links the workspace packages too)
pnpm install

# 2. Configure environment
cp apps/admin/.env.example apps/admin/.env.local
# then edit apps/admin/.env.local — fill in NEXT_PUBLIC_API_URL etc.

# 3. Run the dev server
pnpm dev
# open http://localhost:3000
```

## Environment variables

All variables live in `apps/admin/.env.local`. The example file documents every key. The important ones:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_API_URL` | Public-facing API base URL the browser hits, e.g. `https://api.offerskatta.com/api` or `http://localhost/api` for dev |
| `NEXT_PUBLIC_API_URL_INTERNAL` | Server-side API URL used by Next rewrites inside Docker (`http://api:4000`); ignored outside Docker |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay publishable key used for Subscription / Boost flows |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase project config for the Google / phone login providers |

**Never commit `.env.local`** — it's gitignored. Only `.env.example` belongs in the repo.

## Common tasks

```bash
pnpm dev          # admin at http://localhost:3000
pnpm build        # production build
pnpm start        # serve the production build
pnpm lint         # eslint across all workspace packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm format       # prettier --write
```

## Docker

The admin app ships with `apps/admin/Dockerfile` (prod) and `apps/admin/Dockerfile.dev`. They're used by the original monorepo's compose files. To use them here you'll need a compose file referencing this repo's path — happy to add one if needed.

## Project structure inside `apps/admin/src`

| Path | What it is |
|---|---|
| `app/` | Next.js App Router pages — `app/admin/*` for super-admin, `app/seller/*` for seller panel, `app/(auth)/*` for login/register |
| `components/` | Reusable React components — `ui/` is the shadcn-derived primitive set, the rest are app-specific |
| `lib/` | Cross-cutting helpers — `api.ts` (axios client), `auth-context.tsx` (auth provider), `razorpay.ts` (Razorpay SDK loader), `utils.ts` (cn, formatters) |
| `hooks/` | Custom React hooks |

## How this repo relates to the monorepo

This repo was split out of [GovindDharne/OffersKatta](https://github.com/GovindDharne/OffersKatta). The shared packages (`packages/shared`, `packages/ui`, `packages/config`) are **copies** of the upstream versions. If upstream changes those packages, the changes must be synced over manually (`rsync` / robocopy / git subtree). Treat the upstream monorepo as the source of truth for cross-cutting concerns (DTOs, enums, etc.) until / unless those packages get published to npm.

## License

Proprietary — see the parent OffersKatta repo.
