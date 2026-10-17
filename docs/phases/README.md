# Phases — Build Plan (single release, no v2)

Phases are sequential. Do not start phase N+1 until phase N gate is green. Testing runs alongside every phase (see `../TESTING.md`).

| Phase | File | Goal | Gate |
|-------|------|------|------|
| 01 | `phase-01-foundation.md` | Monorepo folder structure + toolchain, no logic code | `bun install && turbo build` green on empty packages |
| 02 | `phase-02-database.md` | Schema design + DB connection + seed + tests | `bun run db:migrate && bun run db:seed` + vitest green |
| 03 | `phase-03-backend.md` | Auth + API + Hooks + Triggers/Actions + Processor/Worker/Scheduler | `docker-compose up` → signup → create Zap → curl webhook → action runs |
| 04 | `phase-04-frontend/frontend-planning/` (requirements, pages, user-flows, design-system, content) | All Next.js web UI in one phase | Create Zap + history + detail work against real API |
| 05 | `phase-05-devops.md` | Docker + K8s + CI/CD + observability | `kind` deploy + k6 100rps lag<5s; Oracle prod live |

Reference docs: `../BRD.md`, `../PRD.md`, `../TRD.md`, `../DATAFLOW.md`, `../CLOUD-HOSTING.md`, `../TESTING.md`.

Target tree (all phases combined):

```text
zapier-monorepo/
├── package.json / bun.lock / turbo.json / tsconfig.base.json / eslint.config.js
├── .dockerignore / .env.example
├── apps/web, apps/api, apps/hooks, apps/processor, apps/worker, apps/scheduler
├── packages/db, packages/kafka, packages/schemas, packages/triggers, packages/actions, packages/logger, packages/config (no packages/ui)
├── infra/docker, infra/k8s/base, infra/k8s/overlays/dev|staging|prod
├── .github/workflows/ci.yml, cd.yml
└── docs/
```
