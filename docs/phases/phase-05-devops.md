# Phase 05 — DevOps (containers + K8s + CI/CD + observability)

Goal: $0 hosting per `../CLOUD-HOSTING.md`. Stateless in K8s, stateful managed.

## Scope
- `infra/docker/docker-compose.yml`: postgres:16, redpanda (kafka-compatible), redis:7 (noeviction) + all apps. Plus `prometheus.yml` only (redpanda config inline, no redpanda.yml).
- Per-app multi-stage Bun `Dockerfile` (multi-arch linux/arm64,amd64) → `ghcr.io/<user>/zap-<app>:<sha>` via buildx + turbo prune.
- `infra/k8s/base/`: namespace, `api/hooks/web` Deployment+service (ingress-facing) with health probes, `processor/worker/scheduler` Deployment only (no Service, no ingress), `api/hooks` HPA (CPU 60%; RPS via custom metrics, CPU fallback) 2→5, `worker` KEDA ScaledObject (`lagThreshold:100`, max 10), `processor` 2 replicas (SKIP LOCKED safe), `scheduler` 1 replica + liveness, `ingress.yaml` (Cloudflare Tunnel → NGINX, auto TLS), `configmap.yaml` (non-secrets), `externalsecret.yaml` (`DATABASE_URL, DIRECT_URL, JWT_PASSWORD, TOKEN_ENC_KEY, SMTP_*, SLACK_*, DISCORD_*, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GMAIL_APP_ID, GMAIL_APP_SECRET, GITHUB_APP_ID, GITHUB_APP_SECRET, OAUTH_REDIRECT_URL, WEB_URL`), `migrate-job.yaml` (advisory lock `prisma migrate deploy + seed`), PDB, probes (`/healthz` liveness, `/readyz` DB+Kafka readiness), retention CronJob (IdempotencyKey 30d, DLT, runs+steps 90d).
- `infra/k8s/overlays/dev|staging|prod`: replicas/resources/domains/broker URLs (Windows dev uses `kind`, prod Oracle K3s + Neon pooled + Upstash, web on Vercel free).
- `.github/workflows/ci.yml` (`bun install → turbo lint/test/build + vitest security tests`, no push on PR), `cd.yml` (main: push GHCR → kustomize → kubectl apply via SSH/Tailscale → rollout status; staging auto, prod manual approve).
- Observability: all services log JSON with `traceId=zapRunId` to Loki, Prometheus metrics for latency/run rate/`kafka_lag`/`zap_runs_total{status}`/`action_duration{action}`/`http_duration`/`scheduler_missed_ticks`; alerts lag>5min, failure>5%, hooks 5xx>1%, scheduler miss. Screenshot for README/resume + runbook.

## Exit gate
1. `docker-compose up` passes F-5. 2. `kind` + k6 100rps lag<5s. 3. `https://hooks.<domain>/healthz` 200 on Oracle. 4. Public UI creates Zap, webhook fires, action arrives. 5. README has live links + Grafana screenshot.
