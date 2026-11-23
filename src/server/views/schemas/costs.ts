import { z } from 'zod';

import { NODE_KINDS } from '../../../lib/estimate/node-kinds';

/**
 * The contract of `GET /api/v1/estimates/{id}/costs` (STORY-06.02 AC-4; architecture sections 4.3, 4.8 and 6 "Cost"): the figures of the estimate review (SCR-06), for the Lead and
 * the Admin only. **Restricted** (NFR-002, ADR-008): every figure here is a cost, so nothing an Engineer may call has a schema like this one. The route is in the manifest for the Lead and
 * the Admin alone, `withRoute` refuses every other role before anything is looked up, and `tests/security/engineer-import-rule.test.ts` and the lint refuse this file to an Engineer view.
 *
 * **One route, one schema.** Everything is a strict object, so a key that is not named is an error and never reaches a client. **No rolled-up figure** (architecture section 4.3, test
 * `no-rolled-up-figure`): the only figures with more than one row behind them are `totalPrice` (BL, the plain sum of every row's BG), `pricePerToolCost` (BN) and `toolCostTotal`.
 * A node carries its own row's figures and nothing summed over the rows below it: no item total, no sum of children, no multiplier from the rows above.
 *
 * **Figures only while `current`** (architecture section 4.8): in the states `none` and `out-of-date` every `figures` is `null` and so is `totals`. The count (H) is an input, so it stays.
 *
 * Every figure is full-precision decimal text, never a JavaScript number (ADR-005); the screen rounds it to two decimals.
 *
 * **BO is not a calculated figure** (STORY-06.06 AC-9, SQR-07 of AQP-321): `approval` is read from the estimate's latest `approvals` row, never through the figure state, so it is there
 * in every state (clearing the calculated figures cannot change it) and `null` only before any approval or once the Admin removed its price (STORY-06.13: `priceRemoved` then says who and when, and holds no price). `calculationId` is the calculation the figures come from, for the approval's request: it is there only
 * while the state is `current`, like every figure, and it is the only ID of the answer besides the parts'.
 */

/** A stored decimal as text: digits, an optional point and digits, an optional sign. */
const decimalText = z.string().regex(/^-?\d+(\.\d+)?$/);

export const FIGURE_STATES = ['none', 'current', 'out-of-date'] as const;

/** A row's own calculated figures: its BG, and the same in US dollars (BJ) and in euros (BK). `null` is "no figure" (a dash). */
const rowFiguresSchema = z.strictObject({
  unitPrice: decimalText.nullable(),
  unitPriceUsd: decimalText.nullable(),
  unitPriceEur: decimalText.nullable(),
});

/** One part, in reading order: where it sits, what it is called, its count for the whole order (H) and its own figures while they may be shown. */
const costNodeSchema = z.strictObject({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  slNo: z.string().min(1),
  /** The row's stored kind (CR-01 item 3B: the review tree draws its icon). It holds no figure; this view is the Lead's and the Admin's, and the Engineer's tree carries the same fact (`treePartSchema`). */
  nodeKind: z.enum(NODE_KINDS),
  /** The part's name as typed (Description, else Part No.), or an empty text when neither was typed. */
  name: z.string(),
  count: decimalText.nullable(),
  figures: rowFiguresSchema.nullable(),
});

/** The product's figures: BL, BN and the total Tool Cost. The only sums in the answer. */
const totalsSchema = z.strictObject({
  totalPrice: decimalText.nullable(),
  pricePerToolCost: decimalText.nullable(),
  toolCostTotal: decimalText.nullable(),
});

/** The Excel column letters of the figures, derived from the configuration version the calculation used (FR-021): they are never typed into a screen. */
const lettersSchema = z.strictObject({
  count: z.string().min(1),
  unitPrice: z.string().min(1),
  unitPriceUsd: z.string().min(1),
  unitPriceEur: z.string().min(1),
  totalPrice: z.string().min(1),
  pricePerToolCost: z.string().min(1),
  approvedPrice: z.string().min(1),
});

/**
 * The unlock of the latest approval (STORY-06.08 AC-3): who (their name now), when, the reason as the Lead stored it, and the name of the Engineer whose Open queue the task is back in. Text and a time: nothing here is a
 * cost. Present only once the approval was unlocked, and then BO is the price "approved earlier".
 */
const unlockSchema = z.strictObject({
  at: z.iso.datetime(),
  byName: z.string().min(1),
  reason: z.string().nullable(),
  engineerName: z.string().min(1),
});

/**
 * The cancel of the latest approval (STORY-06.12 AC-6): who (their name now), when, the reason as the Admin stored it, and the name of the Engineer whose task it is. Text and a time: nothing here is a cost. Present only
 * once the approval was cancelled, and then BO is the price marked "Approval cancelled". Whether the cancel moved the estimate is read from the approval having no unlock: an approval that was never unlocked was cancelled
 * while the estimate was APPROVED, so the cancel took it to Draft and reopened the task.
 */
const cancelSchema = z.strictObject({
  at: z.iso.datetime(),
  byName: z.string().min(1),
  reason: z.string().nullable(),
  engineerName: z.string().min(1),
});

/**
 * The removal of the latest approval's price (STORY-06.13 AC-3): who (their name now) and when. Text and a time, **never the price** (AC-6): once the Admin removed it, no route serves it to a screen, and the only read
 * of it is the Admin's audit entry. Present only while the latest approval's price is removed, and then `approval` is `null` and BO reads "Not set yet".
 */
const priceRemovedSchema = z.strictObject({
  at: z.iso.datetime(),
  byName: z.string().min(1),
});

/**
 * The estimate's latest approval, unless its price was removed: the Approved Quote Price (BO) as rupees with two decimals, when it was approved and by whom (their name now), and its unlock once it has one (STORY-06.08 AC-3).
 * **Whether it is an override** (STORY-06.07 AC-3,
 * FR-103): the calculated total (BL) the price was set against, as rupees and paise as the approval kept it, the flag, and the reason the Lead gave (`null` when none; always `null` unless the price is an
 * override). They are the approval's own record, read from its row and never through the figure state, like the price. This answer is the Lead's and the Admin's: the route refuses an Engineer before it reads
 * anything, so the reason and the total reach no Engineer (NFR-002, FR-011).
 */
const approvalSchema = z
  .strictObject({
    /** The approval's ID, which the Admin's Cancel approval request names so a newer approval is never cancelled unseen (STORY-06.12 AC-5, `APPROVAL_CHANGED`). */
    id: z.uuid(),
    price: z.string().regex(/^\d+\.\d{2}$/),
    approvedAt: z.iso.datetime(),
    approverName: z.string().min(1),
    /** The Engineer whose task it is (their name now): the Cancel approval dialog says whose Open queue the task returns to (STORY-06.12). A person's name, not a cost. */
    engineerName: z.string().min(1),
    calculatedTotal: z.string().regex(/^\d+\.\d{2}$/),
    isOverride: z.boolean(),
    reason: z.string().min(1).nullable(),
    unlock: unlockSchema.nullable(),
    cancel: cancelSchema.nullable(),
  })
  .refine((approval) => approval.isOverride || approval.reason === null, { message: 'A reason belongs to an override.', path: ['reason'] });

/**
 * The quantity warning of the calculation in view (STORY-06.10 AC-3; architecture section 4.3 "What the Lead sees"): who pressed Calculate or Recalculate and went ahead (their name now: the calculation's `created_by`
 * is the acknowledgement), and each row that had 0 in QTY per Assy, by its part, Sl. No and name **as text at that moment**. No figure and no code. The time is the calculation's own, `calculatedAt`. It is there
 * only while the state is `current` (AC-4), like every figure: while the figures are cleared the list may be stale, so it is not read at all.
 */
const warningSchema = z.strictObject({
  madeBy: z.string().min(1),
  rows: z
    .array(z.strictObject({ nodeId: z.string().min(1), slNo: z.string().min(1), label: z.string() }))
    .min(1)
    .readonly(),
});

/**
 * What changed in the masters since the calculation in view (STORY-06.11 AC-7; FR-106; architecture section 4.8 "Rates changed since the last calculation"): **three counts by kind and nothing else** (NFR-002):
 * the customer's process rates the formulas read, the materials' prices, and the exchange rates. No old value, no new value and no ID, so the notice can say how many and never how much. It is there only while the
 * state is `current` and the estimate is not APPROVED, and only when something changed (a master that was saved again with the same number changed nothing); otherwise it is `null` and the screen draws no notice.
 * It is as true as the page load: a rate that changes while the page is open is not caught (the limit of STORY-06.11).
 */
const ratesChangedSchema = z
  .strictObject({
    processRates: z.number().int().nonnegative(),
    materialPrices: z.number().int().nonnegative(),
    exchangeRates: z.number().int().nonnegative(),
  })
  .refine((counts) => counts.processRates + counts.materialPrices + counts.exchangeRates > 0, { message: 'A notice needs a change to tell.' });

export const costsSchema = z.strictObject({
  state: z.enum(FIGURE_STATES),
  /** The calculation the figures come from, while the state is `current`; `null` otherwise. The approval names it (`POST .../approve`, `calculationId`). */
  calculationId: z.uuid().nullable(),
  /** When the calculation was made (ISO 8601, UTC); `null` while there is none. */
  calculatedAt: z.iso.datetime().nullable(),
  /** The number of the configuration version the calculation used; `null` while there is none. */
  configurationNumber: z.number().int().positive().nullable(),
  letters: lettersSchema,
  nodes: z.array(costNodeSchema).readonly(),
  totals: totalsSchema.nullable(),
  /** BO: the approved price and who approved it, or `null` before any approval. */
  approval: approvalSchema.nullable(),
  /** The removal of the latest approval's price, who and when and never the price (STORY-06.13); `null` unless the latest approval's price was removed. Then `approval` is `null` too. */
  priceRemoved: priceRemovedSchema.nullable(),
  /** The quantity warning on the calculation the figures come from; `null` when there is none, and always `null` unless the state is `current` (AC-4). */
  warning: warningSchema.nullable(),
  /** What changed in the masters since this calculation, by kind (STORY-06.11); `null` unless the state is `current`, the estimate is not APPROVED and something changed. */
  ratesChanged: ratesChangedSchema.nullable(),
});

export type CostsView = z.infer<typeof costsSchema>;
export type CostNode = CostsView['nodes'][number];
