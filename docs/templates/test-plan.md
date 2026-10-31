# Test Plan — <<Project / Release>>

| Field | Value |
|-------|-------|
| Owner | qa-engineer |
| Version | 0.1 |
| Based on | PRD v<<x>>, architecture test-strategy v<<x>> |

## 1. Objectives & Scope
In scope (features, NFRs) · Out of scope · Assumptions.

## 2. Test Approach
| Level | Purpose | Owner | Tooling | Location | Entry / exit criteria |
|-------|---------|-------|---------|----------|-----------------------|
| Unit | Logic correctness | developer | | `tests/unit` | |
| Integration / contract | Interfaces | developer + QA | | `tests/integration` | |
| Acceptance | ACs | qa-engineer | | `tests/acceptance` | |
| E2E | Critical journeys | qa-engineer | | `e2e/` | |
| Non-functional | Perf, security, a11y | qa-engineer | | | |
| Exploratory | Risk discovery | qa-engineer | charters | report | |

## 3. Risk-Based Prioritisation
| Area / feature | Impact | Likelihood | Risk | Test depth |
|----------------|--------|-----------|------|-----------|

## 4. Environments & Test Data
Environments, data strategy (synthetic only), reset/seed approach, third-party stubs.

## 5. Entry & Exit Criteria
- Entry (story): G6 passed, build green, test env available.
- Exit (story): all ACs passed, no open Sev-1/Sev-2, regression green.
- Exit (release): see G8.

## 6. Defect Management
Severity definitions (Sev-1 Critical … Sev-4 Minor), priority, lifecycle
(New → Open → Fixed → Verified → Closed / Reopened), SLAs.

## 7. Regression Strategy
Suite composition, run frequency, flaky-test policy.

## 8. Reporting & Metrics
Pass rate, AC coverage, defect density, defect removal efficiency (review vs QA vs escaped).
