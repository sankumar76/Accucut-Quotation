import { z } from 'zod';

/**
 * The contract of `GET /api/v1/estimates/{id}/nodes/{nodeId}/costs` (STORY-06.03 AC-1, AC-7, AC-8; architecture sections 4.9 and 6 "Cost details"): the cost details of one row (SCR-07), for the Lead and the
 * Admin only. **Restricted** (NFR-002, ADR-008): it holds formulas, rate values and calculated costs, so nothing an Engineer may call has a schema like this one. The route is in the manifest for the
 * Lead and the Admin alone, `withRoute` refuses every other role before anything is looked up, and the lint and `tests/security/engineer-import-rule.test.ts` refuse this file to an Engineer view.
 *
 * **One route, one schema, everything strict**: a key that is not named is an error and never reaches a client. **The state alone while nothing is current** (FR-100): in `none` and `out-of-date` the
 * answer holds the row's place and name and `details: null`, so no stage, formula, operand or figure can be in it. While `current`, `details` holds the six stages of the row and nothing of any other row.
 * A "Not applicable" row (D-17) carries no `Material-*` operand and no material rate: its lines that name the material have a formula and a value and no worked line, and its material rate is blank.
 *
 * A value is full-precision decimal text, never a JavaScript number (ADR-005); a worked line is text with its operands already printed (calculated values to 4 decimals, inputs and rates as typed).
 */

/** A stored decimal as text: digits, an optional point and digits, an optional sign. */
const decimalText = z.string().regex(/^-?\d+(\.\d+)?$/);

export const NODE_COST_STATES = ['none', 'current', 'out-of-date'] as const;
export const NODE_COST_LINE_KINDS = ['calculated', 'typed', 'lookup'] as const;

/** One line of a stage: the column tag, the name, the formula in letters, the same formula with values, and the value. */
const lineSchema = z.strictObject({
  letter: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(NODE_COST_LINE_KINDS),
  /** The sub-heading of the stage the line is under (for example "Surface Treatment"), or `null`. */
  group: z.string().min(1).nullable(),
  /** The unit the value is shown with (kg, sq in, $, €), or `null`. */
  unit: z.string().min(1).nullable(),
  /** The formula as the registry holds it, in column letters and rate names. `null` for a value that is typed or looked up. */
  formula: z.string().min(1).nullable(),
  /** The same formula with the values it was worked out from. `null` where there is none to print. */
  working: z.string().min(1).nullable(),
  /** The stored value; `null` is "no figure" (a dash on the screen), or a value left blank when `blank` is true. */
  value: decimalText.nullable(),
  /** True where the value is empty on purpose (the material rate of a "Not applicable" row): an empty cell, not a dash. */
  blank: z.boolean(),
  /** True for a treatment line whose flag is not selected. It is still calculated and exported as 0, and the screen does not list it. */
  hidden: z.boolean(),
});

/** The total on a stage's heading, and what the lines as shown add to when that differs from the rounded total. */
const stageTotalSchema = z.strictObject({
  letters: z.array(z.string().min(1)).readonly(),
  value: decimalText.nullable(),
  shownLinesSum: decimalText.nullable(),
});

const stageSchema = z.strictObject({
  number: z.number().int().positive(),
  name: z.string().min(1),
  subHeadings: z.array(z.string().min(1)).readonly(),
  lines: z.array(lineSchema).readonly(),
  total: stageTotalSchema.nullable(),
});

/** The row, which the page names in every state: its place in the tree and its name (inputs, not figures). */
const rowSchema = z.strictObject({
  nodeId: z.string().min(1),
  slNo: z.string().min(1),
  /** The part's name as typed (Description, else Part No.), or an empty text when neither was typed. */
  name: z.string(),
});

const detailsSchema = z.strictObject({
  /** When the calculation was made (ISO 8601, UTC). */
  calculatedAt: z.iso.datetime(),
  /** The number of the configuration version the calculation used, whose letters and formulas these are. */
  configurationNumber: z.number().int().positive(),
  /** The Excel letters of the row's count (H) and of its own price (BG), derived from that version (FR-021). */
  letters: z.strictObject({ count: z.string().min(1), unitPrice: z.string().min(1) }),
  /** The row's count for the whole order, as typed. */
  count: decimalText.nullable(),
  /** True for a row whose material is "Not applicable". */
  notApplicable: z.boolean(),
  /** How many treatment lines are hidden because their flag is not selected. */
  hiddenLineCount: z.number().int().min(0),
  stages: z.array(stageSchema).readonly(),
});

export const nodeCostsSchema = z
  .strictObject({
    state: z.enum(NODE_COST_STATES),
    row: rowSchema,
    /** The six stages, only while the state is `current`; `null` in the other two states. */
    details: detailsSchema.nullable(),
  })
  // The one rule that keeps a stage out of a cleared answer (FR-100): a stage is there exactly when the state is `current`, so an answer that holds both a stage and `none` or `out-of-date` cannot be made.
  .refine((answer) => (answer.state === 'current') === (answer.details !== null), { message: 'The stages are in the answer exactly when the state is current.' });

export type NodeCostsView = z.infer<typeof nodeCostsSchema>;
export type NodeCostsLine = z.infer<typeof lineSchema>;
export type NodeCostsStage = z.infer<typeof stageSchema>;
