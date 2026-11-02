# ADR-002: Single-host Docker Compose deployment

| Field | Value |
|-------|-------|
| Status | Accepted (G3 CONDITIONAL GO, condition 14, 2026-11-01). **Rests on assumption A-01** until the open part of Q-18 is answered. Revised for v0.3 (D-15) and for architecture v0.8: backups stay on the same server (AQP-1 comment 10550), for `master` to check at G4 |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh and Accucut IT at G3) |
| Related | NFR-003, 011, 012, 013, 030; FR-091; Q-18; ADR-001 |

## Context
Release 1 is hosted on the internet (D-10). SPEC §2 and FR-091 fix Docker Compose with app, worker and Postgres. Hosting details were open (Q-18). Answered in part on 2026-11-01 (D-15): e-mail service Microsoft Outlook; backup once a week, kept 2 years, the Admin looks after them; updates by their IT person. Answered on 2026-11-02 (AQP-1 comment 10550): "Yes only Admin only checks", "Backup on the same server". Still open: web address, sender address, which Outlook account, who holds the backup key and who restores. The design does not wait for them.

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
- Negative / trade-offs accepted: **with backups on the same server, a server or disk failure loses the live data and every backup together. Nothing can be recovered, and the portal starts again empty** (AQP-1 comment 10550, their decision, and they were told; RISK-011; architecture section 9.5). A bad update on a healthy server loses up to 7 days, or 14 if one run fails unnoticed. About 105 full copies on one disk also mean the 40 GB disk is too small, and a full disk stops PostgreSQL (ARCH-R7). Deployment has a brief interruption, which NFR-012 allows.
- Follow-up actions (with owners): Santhosh and Accucut IT answer the open part of Q-18, and say who holds the backup key and who restores; Accucut IT sizes the disk from architecture section 9.5; developer writes Compose and the README; the IT person confirms disk encryption.

## Verification
Timed clean-machine walk-through (NFR-030). Restore rehearsal from an encrypted weekly copy (NFR-013), which proves a restore on a healthy server only: the loss of the server cannot be rehearsed, as nothing survives it. External monitor reading over a month (NFR-012).
