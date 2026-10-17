# CLOUD-HOSTING — $0 Web + Docker + K8s Plan

## 1. Principle
Stateless in K8s, stateful as managed/free services. Never run Postgres/Kafka as production StatefulSets.

## 2. Images & Registry (free)
- One multi-stage Bun Dockerfile per `apps/*`. Tag `ghcr.io/<user>/zap-<app>:<sha>`.
- Build in GH Actions (`docker buildx`, turbo prune). Push to GHCR (free, private ok).

## 3. Runtime Targets
| Env | Where | Cost | Use |
|-----|-------|------|-----|
| Dev | `docker-compose` (postgres:16, redpanda, redis:7 + apps) on laptop | $0 | Daily dev, demo video |
| K8s-local | `kind` + `kubectl apply -k infra/k8s/overlays/dev` | $0 | Learn HPA/KEDA/Ingress |
| Web-prod | Oracle Always-Free (4 ARM OCPU/24GB) + K3s + public IP | $0 forever | Resume live-demo link |
| Data-prod | Neon Postgres free + Upstash Kafka/Redis free | $0 | Survives pod restarts |
| Edge | Cloudflare Tunnel → Ingress-NGINX, auto TLS | $0 | No firewall rules, `https://*.yourdomain` |
| Web UI | Vercel free (or in-cluster) | $0 | Fast CDN |

Windows note: prefer `kind` over Minikube (1/3 RAM, no Hyper-V pain).

## 4. K8s Layout (`infra/k8s/`)
```
base/: namespace, api/hooks/web deployments+services (ingress-facing),
      processor/worker/scheduler deployments only (no Service, no ingress),
      ingress, configmap, externalsecret, migrate-job,
      worker keda-scaledobject (kafka lag), api/hooks hpa (cpu/rps)
overlays/dev|staging|prod: replicas, resources, domains, broker URLs
```
- `api/hooks/web`: HPA 2→5 on CPU 60% / RPS.
- `worker`: KEDA `lagThreshold:100`, `cooldown:300s`, max 10. Interview line: event-driven autoscaling.
- `processor`: 2 replicas (row locks make it safe). `scheduler`: 1 replica.
- Probes: `GET /healthz` liveness, `GET /readyz` (DB+Kafka) readiness. PDB + requests/limits on all.

## 5. Config & Secrets
- ConfigMap: `NODE_ENV, KAFKA_BROKERS, TOPIC, REDIS_URL, BACKEND_URL, HOOKS_URL`.
- ExternalSecrets → Vault/Infisical/Oracle Vault: `DATABASE_URL, DIRECT_URL, JWT_PASSWORD, TOKEN_ENC_KEY, SMTP_*, SLACK_*, DISCORD_*, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_REDIRECT_URL, WEB_URL`. Never baked in image, never committed.
- `migrate-job` with advisory lock runs `prisma migrate deploy + db seed` on each deploy before rollout. Images multi-arch `linux/arm64,amd64` (Oracle ARM + laptop). Redis `noeviction` (denylist/state safe). Neon via pooled connection (PgBouncer).

## 6. CI/CD (free)
- `ci.yml`: `bun install → turbo lint/test/build → docker build (no push on PR)`.
- `cd.yml` (main): buildx push → `kustomize build overlays/prod | kubectl apply` via Tailscale/SSH to Oracle → `kubectl rollout status`.
- Staging namespace auto-deploys PRs; prod requires manual approve.

## 7. Observability (free tier)
- `kube-prometheus-stack` (or victoria), Loki+Promtail, Grafana dashboard JSON in `infra/docker/`.
- Alerts: `kafka_lag>5min`, `failure_rate>5%`, `hooks_5xx>1%`, `scheduler_missed_ticks>0`. Screenshot for README/resume. Retention cron for IdempotencyKey/DLT/runs+steps 90d.

## 8. Go-Live Checklist
1. `docker-compose up` passes F-5 manual test.
2. `kind` deploy + `k6 100rps` lag<5s.
3. Oracle K3s + Tunnel + Neon/Upstash live, `https://hooks.<domain>/healthz` 200.
4. Vercel env points to Oracle API/hooks. Create Zap from public UI, curl webhook, email/slack arrives.
5. Paste live links + Grafana screenshot into README + resume.
