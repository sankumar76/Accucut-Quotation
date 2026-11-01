# ADR-014: Master data outside the public repository

| Field | Value |
|-------|-------|
| Status | Proposed. The location of the delivery lead's file is theirs to decide at HOLD-01 |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3 and HOLD-01) |
| Related | NFR-006; TR-002, TR-009; D-09, D-13; DL-008; G2 conditions 5, 8; RISK-006 |

## Context
The repository is public and stays public by the delivery lead's decision (D-13). Their statement that the sample holds no real data is unverified and in any case does not cover data not yet supplied: the master data defaults promised on AQP-10 may be real. Rates are Restricted. Anything committed is world-readable, and removing it later means a history rewrite that needs their explicit authorisation.

## Decision Drivers
- CLAUDE.md §6 rule 7, NFR-006: no real data in code, tests, fixtures or documents
- G2 condition 5: state where it is loaded from
- D-09: values are entered when the app is first used; the delivery lead also provides defaults
- FR-091: a clean install must work with no real data

## Considered Options
### Option A — Keep real data out of the repository entirely: Admin entry or a one-off importer from a private file
- Pros: nothing to leak; matches D-09; works whichever option they pick
- Cons: a manual step at go-live; a second path to test
- Cost / effort: low

### Option B — Encrypted seed file in the repository
- Pros: repeatable
- Cons: ciphertext of rates in public history for ever; a key to manage
- Cost / effort: medium, worse exposure

### Option C — Make the repository private
- Pros: strongest simple control
- Cons: they decided against it (D-13). Not reopened here, and agents do not change visibility
- Cost / effort: not applicable

### Option D — Seed in a separate private repository
- Pros: versioned
- Cons: an extra repository and credential; not needed for a one-time load
- Cost / effort: medium

## Decision
Real master data never enters this repository. The two ways in are:

1. **Default:** the Admin types values on the Masters screens at first use (D-09).
2. **Optional:** `npm run import:masters -- --file <path>` inside the `app` container, reading a schema-checked file from a read-only mount outside the repository. There is no default path. The audit entry records counts only, never values.

Before load, the file is held where the delivery lead chooses at HOLD-01. Proposed: Accucut-controlled storage, passed directly to the Admin or IT contact. It is never sent through Jira, GitHub, CI variables or chat. After load, PostgreSQL in the production volume is the system of record, and backups are encrypted.

Development, CI and staging use invented placeholders from `prisma/seed/placeholders/`. Seeding refuses placeholders in production, and no real-data path exists in `prisma/seed`.

**Controls.** Gitleaks on every PR. A CI allow-list for data files (`.csv`, `.xlsx`, new `.json`). Every placeholder number follows a fixed invented pattern, with a test, so a pasted value fails. GitHub secret scanning.

Configuration seed (field registry) is not master data: its formulas are already in the public SPEC, and headers, widths and formats are structure (ASSUMPTION-46).

## Consequences
- Positive: RISK-006's forward path is closed by construction, whatever is decided about the tracked sample.
- Negative / trade-offs accepted: no automated check can recognise a real rate that looks like a placeholder, so the pattern test reduces rather than removes the risk. Real values will not be in automated tests. The parallel run (TR-004) happens on production-class data, outside the repository, and its results are not committed.
- Follow-up actions (with owners): orchestrator states at HOLD-01 that the repository is public and asks where the defaults may be held (G2 condition 8).

## Verification
CI stages on every PR. Check at G8 that no data file has entered the repository. Seed refusal test in production mode.
