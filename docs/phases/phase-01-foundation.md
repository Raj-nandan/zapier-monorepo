# Phase 01 — Foundation (no code)

Goal: create the folder structure + toolchain from the sample tree. No business logic, no DB, no routes.

## Scope
- Root: `package.json` (bun workspaces `apps/*, packages/*`), `bun.lock`, `turbo.json` tasks (`build, dev, lint, test, db:migrate, db:seed`), `tsconfig.base.json`, `.eslintrc.json`, `.dockerignore`, `.env.example` (template only).
- Empty scaffolding only: `apps/web, apps/api, apps/hooks, apps/processor, apps/worker, apps/scheduler` (each with `package.json` + `Dockerfile` + `src/index.ts` health stub), `packages/db, packages/kafka, packages/schemas, packages/triggers, packages/actions, packages/logger, packages/config`, `infra/docker, infra/k8s/base, infra/k8s/overlays/dev|staging|prod`.
- `.github/workflows/` — deferred to Phase 05 (re-add when source code is stable).
- `packages/config`: shared tsconfig. `packages/logger`: pino stub. No `packages/ui` — web-only components live in `apps/web/components/`.
- Files marked `(Phase 02/03/04)` below are created in that phase — not part of Phase 01 scaffolding.

## Out of scope
No Prisma schema, no auth, no webhook logic, no triggers/actions implementations.

## Env
`.env.example` only: `DATABASE_URL, KAFKA_BROKERS, REDIS_URL, JWT_PASSWORD, BACKEND_URL, HOOKS_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_REDIRECT_URL`.

## Exit gate
`bun install && turbo build` green. `turbo dev` starts all apps on health stubs (`GET /healthz` 200).

zapier-monorepo/
├── package.json                  # bun workspaces
├── bun.lock
├── turbo.json                    # build, dev, lint, test, db:* tasks (turbo 2.x)
├── tsconfig.base.json
├── .eslintrc.json                # ESLint 8 legacy config
├── .dockerignore
├── .env.example                  # template only, never real secrets
│
├── apps/
│   ├── web/                      # Next.js + shadcn/ui (Phase 04)
│   │   ├── app/
│   │   │   ├── page.tsx                # Phase 01 stub (Phase 04: landing)
│   │   │   ├── layout.tsx              # Phase 01 stub (Phase 04: root layout)
│   │   │   ├── (auth)/login/page.tsx    # Phase 04
│   │   │   ├── (auth)/signup/page.tsx   # Phase 04
│   │   │   ├── (auth)/forgot/page.tsx   # Phase 04
│   │   │   ├── (auth)/reset/page.tsx     # Phase 04
│   │   │   ├── auth/callback/page.tsx  # Phase 04
│   │   │   └── (dashboard)/layout.tsx   # Phase 04
│   │   │       ├── dashboard/page.tsx            # Phase 04
│   │   │       ├── zap/create/page.tsx           # Phase 04
│   │   │       ├── zap/[id]/page.tsx             # Phase 04
│   │   │       ├── history/page.tsx              # Phase 04
│   │   │       ├── analytics/page.tsx            # Phase 04
│   │   │       ├── settings/page.tsx             # Phase 04
│   │   │       ├── not-found.tsx + error.tsx     # Phase 04
│   │   ├── components/               # Phase 04
│   │   ├── public/                   # Phase 04
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts        # Phase 04
│   │   ├── postcss.config.js         # Phase 04
│   │   ├── tsconfig.json
│   │   ├── .eslintrc.json            # Phase 04
│   │   ├── components.json           # Phase 04
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── api/                      # auth + Zap CRUD (Phase 03)
│   │   ├── src/index.ts           # Phase 01 stub
│   │   ├── src/routes/            # Phase 03
│   │   │   ├── user.ts auth.ts connections.ts zap.ts folder.ts trigger.ts action.ts dashboard.ts runs.ts
│   │   ├── src/lib/               # Phase 03
│   │   │   ├── password.ts jwt.ts oauth.ts email.ts connections.ts
│   │   ├── src/middleware/        # Phase 03
│   │   │   ├── auth.ts rateLimit.ts requestId.ts
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── hooks/                    # webhook ingress (Phase 03)
│   │   ├── src/index.ts          # Phase 01 stub
│   │   ├── src/verify.ts         # Phase 03
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── processor/                # outbox relay (Phase 03)
│   │   ├── src/index.ts          # Phase 01 stub (Phase 03: SKIP LOCKED poller + producer)
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── worker/                   # Kafka consumer (Phase 03)
│   │   ├── src/index.ts          # Phase 01 stub
│   │   ├── src/runner.ts         # Phase 03
│   │   ├── src/parser.ts         # Phase 03
│   │   ├── src/lib/ssrf.ts       # Phase 03
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── scheduler/                # cron/polling trigger (Phase 03)
│       ├── src/index.ts          # Phase 01 stub
│       ├── src/jobs/cron.ts polling.ts  # Phase 03
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                       # single source of truth (Phase 02)
│   │   ├── prisma/schema.prisma  # Phase 02
│   │   ├── prisma/migrations/    # Phase 02
│   │   ├── prisma/seed.ts        # Phase 02
│   │   ├── src/client.ts         # Phase 01 stub (Phase 02: PrismaClient)
│   │   ├── src/index.ts          # Phase 01 stub
│   │   └── package.json
│   ├── kafka/                    # producer/consumer factory (Phase 02)
│   │   ├── src/client.ts         # Phase 02
│   │   ├── src/topics.ts         # Phase 01 stub
│   │   ├── src/index.ts          # Phase 01 stub
│   │   └── package.json
│   ├── schemas/                  # Zod contracts (Phase 02)
│   │   ├── src/zap.ts user.ts trigger.ts action.ts connections.ts runs.ts  # Phase 02
│   │   ├── src/index.ts          # Phase 01 stub
│   │   └── package.json
│   ├── triggers/                 # plugin registry (Phase 03)
│   │   ├── src/types.ts          # Phase 03
│   │   ├── src/index.ts          # Phase 01 stub
│   │   ├── src/schedule/ github-poll/ rss-poll/ manual/  # Phase 03
│   │   └── package.json
│   ├── actions/                  # plugin registry (Phase 03)
│   │   ├── src/types.ts          # Phase 03
│   │   ├── src/index.ts          # Phase 01 stub
│   │   ├── src/email/ slack/ discord/ http-request/ delay/ filter/  # Phase 03
│   │   └── package.json
│   ├── logger/                   # pino + request-id (Phase 02)
│   │   ├── src/index.ts          # Phase 01 stub
│   │   └── package.json
│   └── config/                   # shared tsconfig
│       ├── tsconfig.json
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml    # Phase 01
│   │   └── prometheus.yml        # Phase 01
│   └── k8s/
│       ├── base/                 # Phase 01
│       └── overlays/             # Phase 01
│
├── .gitignore
│
└── docs/                         # Phase 01
