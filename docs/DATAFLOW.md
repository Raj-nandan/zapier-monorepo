# DATAFLOW — End-to-End Flows

## 0. Legend
- Sync (HTTP): `→` returns fast. Async (DB+Kafka): `⇢` processed later.
- Correlation id = `zapRunId` carried from hooks → outbox → Kafka → worker → logs/traces.

## 1. Create Zap (sync)
```
Web UI builder → POST /api/v1/zap/test-trigger {availableTriggerId, triggerMetadata, connectionId?} → 3 samples (no run)
Web UI → POST /api/v1/zap {folderId?, availableTriggerId, triggerMetadata:{cron?, connectionId?}, actions:[{availableActionId, actionMetadata, connectionId?}]}
  API: auth(cookie-or-Bearer) → check owner + connection owner → Zod validate {{refs}} vs fields[] → rate-limit 20/day → tx( Zap.create(revision=1) + Trigger.create + Action.create×N sortingOrder=index + WebhookSecret.create )
  ← { zapId, revision, webhookUrl: https://hooks.<domain>/hooks/catch/<zapId>, secret (once) }
Modify: PUT /zap/:id + If-Match: revision → tx(replace Trigger/Actions, revision++) ; runs carry zapRevision pin. Toggle: PATCH /zap/:id/active.
Seed guarantee: AvailableTriggers/Actions rows exist (db seed).
```

## 2. Fire Webhook Trigger (sync ingress, async execution)
```
External → POST /hooks/catch/:zapId {any JSON ≤1MB} + X-Zap-Signature(hmac ts.body) + X-Zap-Timestamp + X-Idempotency-Key
  Hooks: reject >1MB → verify timestamp ±5min → constant-time HMAC → per-IP 60/min + per-Zap 300/min → check idempotency (30d TTL) → tx( ZapRun{PENDING,metadata:body,zapRevision=zap.revision} + ZapRunOutbox{} )
  ← 200 { zapRunId }  (p99 <300ms, never runs actions inline)
```

## 3. Schedule / Polling Trigger (scheduler → outbox)
```
Scheduler (every 30s, UTC): SELECT Trigger WHERE nextRunAt <= now() FOR UPDATE SKIP LOCKED
  → tx( ZapRun + Outbox + Trigger.nextRunAt = nextCron() + Trigger.lastCursor )
Poll triggers (github/rss): fetch since durable lastCursor → if new items → one ZapRun per item (metadata=item), update cursor in same tx. Single replica + liveness probe; missed-tick alert.
```

## 4. Outbox Relay — Processor (producer, steady flow)
```
loop every 1s:
  rows = SELECT ZapRunOutbox WHERE nextRetryAt<=now() ORDER BY createdAt LIMIT 100 FOR UPDATE SKIP LOCKED
  for row: kafka.send(topic=zap-events, key=zapId, value={zapRunId,zapId,zapRevision,attempt})
  on ack: DELETE outbox row
  on fail: attempts++, nextRetryAt = now()+min(2^attempts,300)s; attempts>10 → move to DLT row
Why: atomic with ZapRun insert; survives Kafka downtime; no dual-write.
Fix vs legacy: publish ID only (not email payload), never delete skipped rows silently.
```

## 5. Execute — Worker (consumer, ordered actions)
```
consumer group=main-worker, fromBeginning=false (prod), autoCommit=false
on msg {zapRunId, zapRevision}:
  ZapRun.status=RUNNING
  fetch ZapRun+Zap(revision=pinned)+Trigger+Actions ORDER BY sortingOrder
  ctx = { metadata: ZapRun.metadata }
  for action in actions:
    if ActionExecution{zapRunId,actionId} exists → skip (redelivery)
    config = parse(action.Metadata, ctx+priorSteps)  // depth≤5, ≤100 subs, ≤10KB out, {{refs}} validated
    if action=filter and !match → write Step(SKIPPED), break chain
    if action=delay → write Step(SUSPENDED) + mark run SUSPENDED + resumeAt, commit offset, scheduler resumes (never sleep worker)
    else → decrypt connection (refresh if needed) → SSRF-checked handler.run with timeout 10-30s → write Step(input,output≤100KB,latency) + ActionExecution
  on success: ZapRun=SUCCESS, commit offset
  on error: write Step(FAILED{error}) → retry (backoff) ×5 → DLT + ZapRun=FAILED{error}
Ordering: Kafka key=zapId keeps per-Zap order; worker runs serially per ZapRun.
Idempotency: ALL actions check ActionExecution dedupe before send.
Replay: POST /runs/:id/replay clones metadata+zapRevision with fresh key → new ZapRun+Outbox (same execute path).
```

## 6. Observe & Debug
```
GET /api/v1/zap/:id/runs?search&status&cursor&limit≤100 → [{id,status,latency,error,createdAt}]
GET /api/v1/runs/:id → {run, steps[]}
POST /api/v1/runs/:id/replay → {newZapRunId}
Grafana: kafka_lag{topic}, zap_runs_total{status}, action_duration{action}, scheduler_missed_ticks
Trace: logs with traceId=zapRunId from hooks→processor→worker in Loki.
Retention: runs+steps kept 90d, then cascade delete.
```

## 7. Failure Matrix
| Failure | Behavior |
|---------|----------|
| Kafka down at webhook time | 200 still returned; rows accumulate in outbox; processor drains on recovery |
| Worker crash mid-chain | No offset commit → redelivery → ActionExecution dedupe prevents double-send for ALL actions |
| Bad action config | Run FAILED, error stored, offset committed (no poison loop), DLT copy for inspection |
| Duplicate webhook (retry) | Same Idempotency-Key (30d) → returns original zapRunId, no new row |
| Oversize/replay webhook | >1MB or stale timestamp → 413/401, no row |
