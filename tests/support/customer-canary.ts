import { SEED_PROCESS_ITEMS } from '../../prisma/seed/config/seed-ids';

import { defined } from './defined';

/**
 * The invented Customer Master rows that STORY-02.02 puts into the cost-confidentiality scan (AC-7; BR-003, NFR-001, NFR-002, test strategy section 6):
 * a customer whose rates carry values that no other test uses, so that finding one in what an Engineer was sent can only mean a customer's rate leaked.
 * They follow the invented pattern `n.37` or `n.73` (ADR-014); none is a rate of Accucut's and none comes from the sample workbook.
 *
 * This file is the single definition of these values and their IDs. `canaryMasters` (`tests/support/canary-masters.ts`) takes the numbers from here, the
 * E2E database gets the rows through `ensureCanaryCustomers` (`tests/e2e/support/auth.ts`, which runs `loadCanaryCustomers`), and the in-memory
 * repository of the security tests is seeded with them (`tests/support/session-harness.ts`).
 *
 * The NAME of the customer is not a forbidden string: the estimate form's list shows customer names to every role (AC-5), so an Engineer is rightly
 * sent it. Only the rates (and the contact details, which `/options/customers` never carries) are Restricted or Confidential.
 */

export interface CustomerCanary {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  /** The rates that differ from the default, by the Process Master item: the first two seed items. */
  readonly rates: ReadonlyArray<{ readonly processItemId: string; readonly value: string }>;
}

/** The values of the canary rates, as `canaryMasters` lists them (a three-digit number ending `.37`). */
export const CUSTOMER_CANARY_VALUES: ReadonlyArray<string> = ['881.37', '882.37'];

/** A telephone-number-shaped sentinel for the contact details, which no Engineer response may carry either. */
export const CUSTOMER_CANARY_PHONE = '+99 555 0173';

/** Fixed IDs, so a recipe in `route-calls.ts` can name a customer that exists in every database the scan reads. */
export const CUSTOMER_CANARIES: ReadonlyArray<CustomerCanary> = [
  {
    id: '00000000-0000-4000-8000-000800000c01',
    name: 'Canary-Customer-Alpha',
    phone: CUSTOMER_CANARY_PHONE,
    rates: CUSTOMER_CANARY_VALUES.map((value, index) => ({ processItemId: defined(SEED_PROCESS_ITEMS[index]).id, value })),
  },
];

/** The customer a recipe for `PATCH /api/v1/customers/{id}` and `POST .../reset-rates` names: it exists wherever the canaries are loaded. */
export const CUSTOMER_RECIPE_ID: string = defined(CUSTOMER_CANARIES[0]).id;
