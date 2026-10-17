# BRD — Business Requirements Document
**Project:** zapier-monorepo (rebuild of `../Automation-Platform---Zapier-`)
**Goal:** Production-grade automation platform for resume + real hosting at $0 cost.

## 1. Background
Legacy prototype proves the happy path (signup → create Zap → webhook → email) but has 3 copied Prisma schemas, hardcoded `localhost:9092`, email-only processor/worker, static frontend pages, no tests, no Docker/K8s. It cannot be hosted or demoed reliably.

## 2. Business Objectives
| ID | Objective | Success Metric |
|----|-----------|----------------|
| BO-1 | Demo microservices + async communication in interviews | Can whiteboard API → Hooks → Outbox → Kafka → Worker without notes |
| BO-2 | Public live demo link on resume | `https://app.<domain>` + `https://hooks.<domain>` up 24/7 at $0 |
| BO-3 | Extensible marketplace story | Adding new trigger/action = 1 folder, no core change |
| BO-4 | Hiring signal | Repo shows Turborepo, Docker, K8s, CI green, Grafana screenshot |

## 3. Stakeholders
- Owner/developer (you) — build + maintain + demo
- Recruiter/hiring manager — reads README + resume bullets only
- Interviewer — deep-dives outbox, Kafka, webhooks, K8s scaling

## 4. Scope (single release, no v2)
**In scope:** Auth (email-password + Google OAuth + GitHub auth), multiple Zaps per user with create + modify, dashboard with active Zaps + activity/analytics, Zap CRUD (1 trigger + N ordered actions), webhook + schedule + polling triggers, email/slack/discord/http/delay/filter actions, atomic transactions + outbox relay, Kafka pipeline, Docker + K8s manifests, observability, CI/CD.
**Out of scope:** Billing/payments, team workspaces, OAuth app store (login OAuth above is in scope), mobile app, multi-region active-active.

## 5. Constraints
- Budget: $0 (Oracle Always-Free + Neon + Upstash free + Vercel free + GHCR free + Cloudflare Tunnel free).
- Runtime: Bun + TypeScript everywhere. No Python/Go services.
- State stays out of K8s: Postgres/Kafka/Redis are managed or single-container Redpanda, never StatefulSets in prod.
- Windows dev machine: must work with `bun dev` + `docker-compose` + `kind` (not Minikube-only).

## 6. Risks
| Risk | Mitigation |
|------|------------|
| Kafka too heavy locally | Use Redpanda (Kafka-compatible, single binary) for dev |
| Scope creep (10 triggers) | Freeze at defined triggers/actions for v1 — no additions mid-build |
| Laptop RAM for K8s | kind (not Minikube) for local K8s; full K8s only on Oracle Free |

## 7. Acceptance
BRD accepted when PRD + TRD + DATAFLOW + CLOUD-HOSTING + `phases/` are approved and `zapier-monorepo/` skeleton builds with `bun install && turbo build`.
