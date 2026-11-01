# Risk Register

> Owned by `master`. Any agent may propose a risk in its hand-off; master records it here.
> Score = Probability (1–5) × Impact (1–5). ≥15 = 🔴, 8–14 = 🟡, ≤7 = 🟢.

| ID | Risk (cause → event → effect) | Category | P | I | Score | Owner | Mitigation | Trigger / early warning | Status |
|----|-------------------------------|----------|---|---|-------|-------|------------|-------------------------|--------|
| RISK-001 | Assistant-drafted answers were posted unedited under one shared Jira account → baseline rules may not be what the delivery lead decided → wrong prices or rework | Governance | 2 | 5 | 10 🟡 | Santhosh | G1 condition 1: confirm each item in his own words, no pre-written reply text. Longer term, give agents their own Atlassian user (playbook §6 item 5) | Any item corrected in the reply; no reply by G2 | Open |
| RISK-002 | Q-08 quantity rule differs from the worksheet when a parent's quantity is above 1 → prices wrong on multi-level products, or acceptance test 2 and the parallel run compare against the wrong figure | Business / correctness | 3 | 5 | 15 🔴 | Santhosh | Q-32 answered or ASSUMPTION-48 accepted before G2 passes; worked examples in the test plan | Q-32 unanswered at the G2 decision | Open |
| RISK-003 | Full spec, three human stops and the master data stop may not fit 10 working days (80 hours) → 2026-11-13 is missed or scope is cut late | Schedule | 4 | 4 | 16 🔴 | Santhosh | Product manager's first-release proposal at G2; Q-29 answered on that proposal | PRD scope exceeds the time available; waits at gates use up working days | Open |
| RISK-004 | Offline is unresolved: AQP-11, in the delivery lead's own words, asks for it and the disputed comment defers it → if kept in Release 1, scope and architecture change, and a local copy would hold rates, against BRQ-002 | Scope | 3 | 4 | 12 🟡 | Santhosh | Offline decision moved from G3 to G2 (G1 condition 5); ASSUMPTION-18 labelled until then | Delivery lead keeps offline in Release 1 | Open |
| RISK-005 | Docs PR cannot be created (BLK-01, 403 although AQP-1 comment 10412 reports read and write access) → inception docs cannot merge at G4 → story branches cannot start | Delivery tooling | 3 | 3 | 9 🟡 | Santhosh | Check the token the GitHub connection actually uses and its repository access, or open the PR by hand | Still 403 at G3 approval | Open |
