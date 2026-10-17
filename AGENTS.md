# AGENT RULES — zapier-monorepo

## Authority
Docs are source of truth. If code contradicts docs, docs win. Never edit docs to match code without explicit permission.

## Before Acting
1. Read relevant docs first (phases/README.md → target phase file → TESTING.md for gates).
2. Verify existing code against docs before changing it.
3. If docs are ambiguous or conflict, ask before proceeding.

## Permissions
- Code changes: only when user explicitly asks or confirms.
- Doc changes: only when user explicitly asks.
- New files/folders: only when user explicitly asks or they are part of an approved phase plan.
- Never delete files without explicit permission.

## Quality Gates
- Current work must be complete, tested, and verified before moving on.
- Never break previous functionality — run existing tests after every change.
- If something breaks: stop, refer to docs, diagnose, fix, verify. Ask user if critical.
- Commit only when explicitly asked.

## Hallucination Guard
- Do not invent routes, endpoints, env vars, secrets, or folder names — all must exist in docs.
- Do not assume libraries are available — check package.json / docs first.
- If unsure whether something exists in docs, grep first. If not found, ask.

## Verification Before Proceed
- `turbo lint && turbo build && turbo test` must pass (or phase gate from docs).
- Check new code against Zod schemas in packages/schemas.
- Check API responses match TRD §5 contracts.
- Check folder structure matches phase-01 tree.

## Critical Situations — Ask User
- Docs conflict with each other or with existing code.
- A change requires touching files not in the current phase scope.
- Tests fail and root cause is unclear.
- Security-sensitive changes (auth, secrets, rate limits).
- Database migrations or schema changes.
