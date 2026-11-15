import { z } from 'zod';

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

export const costsSchema = z.strictObject({
  state: z.enum(FIGURE_STATES),
  /** When the calculation was made (ISO 8601, UTC); `null` while there is none. */
  calculatedAt: z.iso.datetime().nullable(),
  /** The number of the configuration version the calculation used; `null` while there is none. */
  configurationNumber: z.number().int().positive().nullable(),
  letters: lettersSchema,
  nodes: z.array(costNodeSchema).readonly(),
  totals: totalsSchema.nullable(),
});

export type CostsView = z.infer<typeof costsSchema>;
export type CostNode = CostsView['nodes'][number];
