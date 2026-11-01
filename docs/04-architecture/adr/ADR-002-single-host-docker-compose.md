# ADR-002: Single-host Docker Compose deployment

| Field | Value |
|-------|-------|
| Status | Proposed. Revised for v0.3 (D-15). Rests on A-01 until the open part of Q-18 is answered |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh and Accucut IT at G3) |
| Related | NFR-003, 011, 012, 013, 030; FR-091; Q-18; ADR-001 |

## Context
Release 1 is hosted on the internet (D-10). SPEC §2 and FR-091 fix Docker Compose with app, worker and Postgres. Hosting details were open (Q-18). Answered in part on 2026-11-01 (D-15): e-mail service Microsoft Outlook; backup once a week, kept 2 years, the Admin looks after them; updates by their IT person. Still open: web address, sender address, which Outlook account, what "Admin looks after them" means, and where the copies are kept. The design does not wait for them.

**Assumption A-01 (labelled, not a fact):** one Linux VM with Docker, a public DNS name, their IT person as operator.

## Decision Drivers
- NFR-030: `docker compose up` after copying `.env.example`, within 30 minutes
- NFR-012: 99.0 % monthly allows about 7 h 18 min of downtime, so one host is acceptable
- NFR-003: Secure cookies require TLS
- A small IT team; no platform engineering

## Considered Options
### Option A — One VM, Docker Compose, optional Caddy profile for TLS
- Pros: matches SPEC; one file; automatic certificates; runs anywhere, including a future local copy
- Cons: single point of failure; manual host patching
- Cost / effort: lowest

### Option B — Managed platform (container service plus managed Postgres)
- Pros: managed backups, failover, patching
- Cons: moves away from the SPEC's install model; cost and vendor unknown (Q-18); more configuration
- Cost / effort: medium, plus recurring cost

### Option C — Kubernetes
- Pros: self-healing, rolling updates
- Cons: far beyond 25 concurrent users on one app; no operator exists
- Cost / effort: high

## Decision
We will deploy with Docker Compose on one host: `app`, `worker`, `db`, a one-shot `migrate`, and an optional `proxy` profile running Caddy. The profile is optional so that a TLS terminator Accucut already owns can replace it. Everything environment-specific is an environment variable, so Q-18 answers change configuration, not code. If Accucut chooses managed Postgres, `db` drops out and `DATABASE_URL` points elsewhere.

## Consequences
- Positive: the install story is one file, staging is the same file under another project name, and hosting answers do not hold design.
- Negative / trade-offs accepted: host failure means downtime up to the RTO, and **up to 7 days of work lost**, since backups are weekly by the delivery lead's decision, or 14 days if one run fails unnoticed (ARCH-R1; architecture section 9.5). Deployment has a brief interruption, which NFR-012 allows.
- Follow-up actions (with owners): Santhosh and Accucut IT answer the open part of Q-18; developer writes Compose and the README; the IT person confirms disk encryption and sets up the off-host target; the Admin holds the backup key.

## Verification
Timed clean-machine walk-through (NFR-030). Restore rehearsal from an encrypted weekly copy (NFR-013). External monitor reading over a month (NFR-012).
