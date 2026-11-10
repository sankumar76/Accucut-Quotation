/**
 * The invented exchange rates that STORY-02.04 puts into the cost-confidentiality scan (AC-6; BR-003, NFR-001, NFR-002, test strategy section
 * 6): one value for 1 US dollar and one for 1 euro in rupees, which no other test uses, so that finding one in what an Engineer was sent can only
 * mean a rate leaked. They follow the invented pattern `n.37` or `n.73` (ADR-014); none is a rate of Accucut's and none comes from the sample
 * workbook.
 *
 * This file is the single definition of these values. `canaryMasters` (`tests/support/canary-masters.ts`) takes them from here, the E2E database
 * gets the rows through `ensureCanaryExchangeRates` (`tests/e2e/support/auth.ts`), and the in-memory repository of the security tests is seeded
 * with them (`tests/support/session-harness.ts`).
 */

export const EXCHANGE_RATE_CANARIES = { usd: '838.37', eur: '839.73' } as const;
