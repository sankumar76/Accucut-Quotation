/**
 * What the Lighthouse run measures against (NFR-009, G8-C-NFR9, DL-251): the planning volume of NFR-011 and the two task codes that the key-screen
 * addresses of `lighthouserc.cjs` name. The seed script `scripts/seed-lighthouse-data.ts` makes this data in the throwaway database of the nightly job;
 * `tests/unit/lighthouse-data.test.ts` holds the codes and the key screens to each other. Every name and number is invented (NFR-006, ADR-014).
 */

/** PRD NFR-011, master-data volume: up to 500 customers, up to 50 Process Master items (the migration makes 15), up to 200 materials. */
export const CUSTOMER_COUNT = 500;
export const PROCESS_ITEM_TOTAL = 50;
export const SEED_PROCESS_ITEM_COUNT = 15;
export const MATERIAL_COUNT = 200;

/** PRD NFR-011: fewer than 50 users. One Lead who assigns, this many Engineers who own the queue's tasks, and the Admin and the measurement Engineer made apart. */
export const QUEUE_ENGINEER_COUNT = 25;
/** The tasks the queue and the assign screen read, spread over those Engineers. Not a stated figure: about 12 a person is a busy quarter for a small estimating team. */
export const QUEUE_TASK_COUNT = 300;
export const QUEUE_CODE_PREFIX = 'Q-2098-';

/** Task codes of the two estimates (`Q-<year>-<number>`; the year 2099 is one no real task has, as the canary tasks of the E2E suite use). */
export const WORKSPACE_CODE = 'Q-2099-0001';
export const COST_CODE = 'Q-2099-0002';

/** Every number and rate that the seed writes follows the `n.37` pattern of `prisma/seed/placeholders`, so an invented value stands out from a real one. */
export const INVENTED_RATE = '12.37';
export const INVENTED_EXCHANGE_RATES: ReadonlyArray<{ readonly currency: 'USD' | 'EUR'; readonly inrValue: string }> = [
  { currency: 'USD', inrValue: '83.37' },
  { currency: 'EUR', inrValue: '90.37' },
];
export const INVENTED_MATERIAL = { pricePerKg: '90.37', specificGravity: '7.85', scrapRate: '12.37' } as const;

export const FOLDER_PATH = '\\\\invented-server\\invented-share\\RFQ-lighthouse';

/** The e-mail of the Lead and of the nth Engineer of the queue (`n` from 1). */
export const leadEmail = (): string => 'perf-lead@example.test';
export const queueEngineerEmail = (n: number): string => `perf-engineer-${String(n).padStart(2, '0')}@example.test`;

/** `Q-2098-0001`, the code of the nth queue task (`n` from 1). */
export const queueTaskCode = (n: number): string => `${QUEUE_CODE_PREFIX}${String(n).padStart(4, '0')}`;
