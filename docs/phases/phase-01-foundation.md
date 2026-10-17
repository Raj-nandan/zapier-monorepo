# Phase 01 — Foundation (no code)

Goal: create the folder structure + toolchain from the sample tree. No business logic, no DB, no routes.

## Scope
- Root: `package.json` (bun workspaces `apps/*, packages/*`), `bun.lock`, `turbo.json` pipelines (`build, dev, lint, test, db:migrate, db:seed`), `tsconfig.base.json`, `eslint.config.js`, `.dockerignore`, `.env.example` (template only).
- Empty scaffolding only: `apps/web, apps/api, apps/hooks, apps/processor, apps/worker, apps/scheduler` (each with `package.json` + `Dockerfile` + `src/index.ts` health stub), `packages/db, packages/kafka, packages/schemas, packages/triggers, packages/actions, packages/logger, packages/config`, `infra/docker, infra/k8s/base, infra/k8s/overlays/dev|staging|prod`, `.github/workflows/` (empty).
- `packages/config`: shared tsconfig/eslint presets. `packages/logger`: pino stub. No `packages/ui` — web-only components live in `apps/web/components/`.

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
├── eslint.config.js
├── .dockerignore
├── .env.example                  # template only, never real secrets
│
├── apps/
│   ├── web/                      # Next.js + shadcn/ui + React Bits + React Flow (simple light/dark, no pricing)
│   │   ├── app/
│   │   │   ├── page.tsx                # landing about-only (Hero-34, no pricing)
│   │   │   ├── (auth)/login/page.tsx    # Auth-2 (email + Google + GitHub + forgot link)
│   │   │   ├── (auth)/signup/page.tsx
│   │   │   ├── (auth)/forgot/page.tsx   # forgot/reset flow
│   │   │   ├── (auth)/reset/page.tsx
│   │   │   ├── auth/callback/page.tsx  # error-only, cookies hold session (at /auth/callback)
│   │   │   └── (dashboard)/layout.tsx   # sidebar + ThemeToggle
│   │   │       ├── dashboard/page.tsx            # active Zaps + analytics
│   │   │       ├── zap/create/page.tsx       # Flow builder
│   │   │       ├── zap/[id]/page.tsx   # create + modify (Flow)
│   │   │       ├── history/page.tsx
│   │   │       ├── analytics/page.tsx
│   │   │       ├── settings/page.tsx
│   │   │       ├── not-found.tsx + error.tsx
│   │   ├── components/ui/ (shadcn) + marketing/hero-34 + auth/auth-2 + oauth-buttons + forgot/reset forms
│   │   │   ├── layout/theme-provider + theme-toggle + app-shell (next-themes light/dark)
│   │   │   ├── dashboard/zap-table(active toggle+folders/search) + analytics-cards + connections/connect-app
│   │   │   ├── builder/flow-canvas + workflow-node + sample-picker + field-mapper
│   │   │   ├── history/runs-table(replay) + run-steps-drawer
│   │   │   └── lib/api-client + auth-client (credentials:include, no token storage) + query
│   │   ├── public/                     # static assets
│   │   ├── next.config.js             # security headers, rewrites
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json              # extends @repo/config/tsconfig.json
│   │   ├── components.json            # shadcn/ui config
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── api/                      # auth + Zap CRUD + dashboard
│   │   ├── src/index.ts
│   │   ├── src/routes/user.ts            # email signup/signin/forgot/reset + GET /user/ + export/delete
│   │   ├── src/routes/auth.ts            # GET /auth/google, /auth/github, /auth/*/callback (login)
│   │   ├── src/routes/connections.ts     # GET/POST/DELETE /connections/:app (gmail|github app OAuth)
│   │   ├── src/routes/zap.ts folder.ts trigger.ts action.ts dashboard.ts runs.ts  # + test-trigger, replay, steps, active toggle, folders/search
│   │   ├── src/lib/password.ts           # bcrypt hash/verify
│   │   ├── src/lib/jwt.ts                # same JWT for email + OAuth
│   │   ├── src/lib/oauth.ts              # arctic providers + state store (Redis)
│   │   ├── src/lib/email.ts + connections.ts  # SMTP + app-token encrypt/refresh
│   │   ├── src/middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── requestId.ts
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── hooks/                    # webhook ingress ONLY
│   │   ├── src/index.ts          # POST /hooks/catch/:zapId -> tx(ZapRun+Outbox)
│   │   ├── src/verify.ts         # HMAC + idempotency-key
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── processor/                # outbox relay : DB -> Kafka PRODUCER
│   │   ├── src/index.ts          # FOR UPDATE SKIP LOCKED poller + producer
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── worker/                   # Kafka CONSUMER -> action runner
│   │   ├── src/index.ts          # consumer group main-worker
│   │   ├── src/runner.ts         # revision-pinned fetch, ActionExecution dedupe, serial run
│   │   ├── src/parser.ts         # {metadata.*} templating (bounded)
│   │   ├── src/lib/ssrf.ts       # SSRF allowlist
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── scheduler/                # cron/polling trigger producer
│       ├── src/index.ts          # every 30s UTC: due Triggers -> ZapRun+Outbox + delay resume
│       ├── src/jobs/cron.ts polling.ts
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                       # single source of truth
│   │   ├── prisma/schema.prisma  # User, Account(login), ConnectedAccount(app), Folder, Zap(revision/active), Trigger, Action, Available*, ZapRun, ZapRunStep, ZapRunOutbox, ActionExecution, WebhookSecret, IdempotencyKey(TTL), PasswordReset
│   │   ├── prisma/migrations/    # prisma migrate deploy outputs
│   │   ├── prisma/seed.ts        # triggers/actions seed
│   │   ├── src/client.ts         # singleton PrismaClient
│   │   ├── src/index.ts          # export { prisma }
│   │   └── package.json
│   ├── kafka/
│   │   ├── src/client.ts         # producer/consumer factory, idempotent:true
│   │   ├── src/topics.ts         # zap-events, retry, DLT + partitions
│   │   ├── src/index.ts
│   │   └── package.json
│   ├── schemas/
│   │   ├── src/zap.ts user.ts    # Zod contracts API <-> UI
│   │   ├── src/trigger.ts action.ts connections.ts runs.ts
│   │   ├── src/index.ts
│   │   └── package.json
│   ├── triggers/                 # plugin registry (no webhook/ — ingress is apps/hooks)
│   │   ├── src/types.ts          # TriggerHandler/ActionHandler {slug, schema, fields[], fetchSample, run}
│   │   ├── src/index.ts
│   │   ├── src/schedule/ github-poll/ rss-poll/ manual/   # app triggers reuse connections
│   │   └── package.json
│   ├── actions/                  # plugin registry
│   │   ├── src/types.ts          # ActionHandler interface
│   │   ├── src/index.ts
│   │   ├── src/email/ slack/ discord/ http-request/ delay/ filter/   # app actions take connectionId
│   │   └── package.json
│   ├── logger/                   # pino + request-id + otel setup
│   │   ├── src/index.ts
│   │   └── package.json
│   └── config/                   # shared tsconfig + eslint presets
│       ├── tsconfig.json         # base tsconfig (apps extend this)
│       ├── eslint-preset.js
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml    # postgres, redpanda(kafka), redis + all apps (local prod)
│   │   └── prometheus.yml        # redpanda config inline in compose, no redpanda.yml
│   └── k8s/
│       ├── base/
│       │   ├── kustomization.yaml
│       │   ├── namespace.yaml
│       │   ├── api/deployment.yaml + service.yaml + hpa.yaml
│       │   ├── hooks/deployment.yaml + service.yaml + hpa.yaml
│       │   ├── web/deployment.yaml + service.yaml
│       │   ├── processor/deployment.yaml          # no Service (no ingress)
│       │   ├── worker/deployment.yaml + keda-scaledobject.yaml  # no Service
│       │   ├── scheduler/deployment.yaml          # no Service
│       │   ├── ingress.yaml      # api/hosts + TLS
│       │   ├── configmap.yaml
│       │   ├── externalsecret.yaml
│       │   └── migrate-job.yaml  # prisma migrate deploy (default ServiceAccount, no serviceaccounts.yaml)
│       └── overlays/
│           ├── dev/kustomization.yaml
│           ├── staging/kustomization.yaml
│           └── prod/kustomization.yaml  # replicas, resources, domains
│
├── .github/workflows/
│   ├── ci.yml                    # bun install -> turbo build/lint/test
│   └── cd.yml                    # buildx push -> kubectl rollout / argocd
│
├── .gitignore
│
└── docs/
    ├── BRD.md / PRD.md / TRD.md / DATAFLOW.md / CLOUD-HOSTING.md
    └── phases/phase-01-foundation.md … phase-05-devops.md