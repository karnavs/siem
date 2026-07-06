# From portfolio demo to commercial product

SentryGrid is architecturally sound — real auth, real RBAC, a real detection
engine, real AI integration, real infra. But "architecturally sound" and
"ready to bill customers" are different bars. Here's the honest gap list, in
roughly the order I'd tackle it.

## 1. Multi-tenancy (the big one)

The data model already has `Organization` as a first-class concept, and every
query is scoped by `organizationId` — so the schema doesn't need to change.
What's missing:
- **Org-level isolation guarantees**: right now isolation is enforced by
  "every controller remembers to filter by organizationId." That's correct
  today (verify it — every Prisma `findMany`/`findFirst` in `controllers/`
  filters by `req.user.organizationId`), but it's the kind of thing that
  silently breaks when someone adds a new query under deadline pressure.
  Consider row-level security in Postgres, or a query-building layer that
  makes it structurally impossible to forget the filter.
- **Org switching / invitations**: there's no way to invite a teammate into
  an existing org, or to belong to more than one org. Real B2B SaaS needs both.
- **Per-org rate limits and quotas**: the rate limiter is global, not
  per-tenant — one noisy customer can degrade the experience for everyone else.

## 2. Billing

Nothing here. You'd want Stripe (or similar) for subscriptions, usage-based
metering if you price on event volume, and a plan/seat model wired into RBAC.

## 3. Log ingestion at real scale

The current ingestion endpoint does synchronous detection-engine evaluation
on every request — fine for a demo, but it means a burst of events
serializes against a single Express process. For real volume:
- Put ingestion behind a queue (SQS is the natural AWS choice given the rest
  of the stack) and run detection as a worker pulling off it.
- Consider whether Postgres is still the right store for raw events at
  scale, or whether they belong in something built for time-series/log
  volume (OpenSearch, ClickHouse, S3 + Athena) with Postgres staying as the
  system of record for alerts/users/audit.

## 4. Detection engine maturity

The rule engine is deliberately simple and legible — eight rules, each one
readable in under a minute. A production SIEM needs:
- Deduplication against already-open alerts (right now, the same brute-force
  pattern re-evaluated every ingestion batch will keep creating new alerts
  rather than updating one).
- Suppression/tuning per customer (what's "5 failed logins" for one org might
  be normal load-testing traffic for another).
- A much larger rule library, and probably a path to user-defined rules.

## 5. AI cost and reliability controls

`aiTriage.ts` already rate-limits and falls back to mock mode on failure,
which is the right shape. At scale you'd add: response caching for identical
alert patterns, a hard monthly spend cap, and probably a cheaper/faster model
tier for low-severity alerts with the expensive model reserved for CRITICAL.

## 6. Compliance posture

If you're selling into regulated customers, expect to need: SOC 2 (the audit
log and CloudTrail setup here are a reasonable starting point, not a
finished story), data residency options, a documented incident response
process, and a real penetration test before anyone signs a contract.

## 7. Frontend polish for real users

- No mobile-responsive pass yet — the dashboard assumes a wide screen.
- No real-time updates (alerts table is fetch-on-load; a production SOC tool
  usually wants WebSocket/SSE push for new critical alerts).
- No dark/light theme toggle — currently dark-only by design, which is fine
  for a SOC tool, but confirm that's actually what your users want.

None of this invalidates the architecture — it's exactly the right shape to
extend. This list is the difference between "I built a real thing" (true
today) and "paying customers trust this with their security data" (the next
several months of work).
