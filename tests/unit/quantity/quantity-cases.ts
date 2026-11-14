/**
 * The constructed quantity cases CE-1 to CE-12 of test strategy section 5.2 (STORY-03.04; SPEC section 7.4 BL, section 18.5). The expected
 * values were worked by hand in the test strategy before any code existed; they are copied here as text, not computed. All numbers are
 * invented. This one module is the data of both levels (test strategy section 5.3): the unit test runs `SUM` through the evaluator with the
 * stated `bg`, and the integration test runs each row through the calculation service with `h` and `cost` typed and checks `bg` as well.
 *
 * "Per-piece cost" (`cost`) is a row's cost before its own quantity. `h` is the count for the whole order, typed on every row, so the stored
 * BG is `cost x h`. Rows are listed in tree order; the tree itself does not matter to BL, which is what several cases prove.
 */

/** One row of a case. */
export interface CaseRow {
  /** The row's Sl. No in the case's tree, for the failure message. */
  readonly sl: string;
  /** QTY per Assy typed (H): the count for the whole order. */
  readonly h: string;
  /** The cost of one piece, entered as Machining Cost (AP) in the integration run. */
  readonly cost: string;
  /** The stored BG, worked by hand: `cost x h`. */
  readonly bg: string;
  /** Tool Cost (BM) typed on the row, if any. */
  readonly toolCost?: string;
}

/** A wrong answer and the defect it means (test strategy section 5.2), so a failure message tells the developer which. */
export interface WrongAnswer {
  readonly bl: string;
  readonly means: string;
}

export interface QuantityCase {
  readonly id: string;
  readonly title: string;
  readonly rows: ReadonlyArray<CaseRow>;
  /** The expected BL, as the hand-worked table states it. */
  readonly bl: string;
  readonly wrong?: ReadonlyArray<WrongAnswer>;
}

const row = (sl: string, h: string, cost: string, bg: string, toolCost?: string): CaseRow =>
  toolCost === undefined ? { sl, h, cost, bg } : { sl, h, cost, bg, toolCost };

const WITHDRAWN_RULE: WrongAnswer = { bl: '300', means: 'the withdrawn rule: typed counts multiplied down the tree again' };
const OWN_COUNT_TWICE: WrongAnswer = { bl: '612', means: "a row's own H applied twice" };
const COUNT_NOT_APPLIED: WrongAnswer = { bl: '2', means: 'H not applied at all' };

export const QUANTITY_CASES: ReadonlyArray<QuantityCase> = [
  {
    id: 'CE-1',
    title: 'the frames example, typed 2, 6, 24 (AQP-26 comment 10537)',
    rows: [row('1', '2', '0', '0'), row('1.1', '6', '1', '6'), row('1.1.1', '24', '1', '24')],
    bl: '30',
    wrong: [WITHDRAWN_RULE, OWN_COUNT_TWICE, COUNT_NOT_APPLIED],
  },
  {
    id: 'CE-1 (cost on the lid alone)',
    title: 'the frames example with the cost on the sub-part alone',
    rows: [row('1', '2', '0', '0'), row('1.1', '6', '0', '0'), row('1.1.1', '24', '1', '24')],
    bl: '24',
  },
  {
    id: 'CE-2 A',
    title: 'an item with its own cost and a part below it (AQP-26 comment 10535)',
    rows: [row('1', '4', '150', '600'), row('1.1', '12', '20', '240')],
    bl: '840',
    wrong: [{ bl: '1560', means: 'typed counts multiplied down the tree' }],
  },
  {
    id: 'CE-2 B',
    title: 'three levels, each row with its own cost',
    rows: [row('1', '2', '5', '10'), row('1.1', '6', '7', '42'), row('1.1.1', '24', '11', '264')],
    bl: '316',
  },
  {
    id: 'CE-2 C',
    title: 'as A, with 3 typed on the part: a valid estimate, the count taken as typed (ARCH-R6)',
    rows: [row('1', '4', '150', '600'), row('1.1', '3', '20', '60')],
    bl: '660',
  },
  {
    id: 'CE-3',
    title: 'two top-level items (D-12): 2 + 3',
    rows: [row('1', '2', '0', '0'), row('1.1', '2', '1', '2'), row('2', '3', '0', '0'), row('2.1', '3', '1', '3')],
    bl: '5',
  },
  {
    id: 'CE-4 (quantities 1)',
    title: "a parent's own cost counts, and it shows only its own (AQP-1 comment 10542)",
    rows: [row('1', '1', '0', '0'), row('1.1', '1', '10', '10'), row('1.1.1', '1', '5', '5')],
    bl: '15',
    wrong: [{ bl: '5', means: 'a children-only reading' }],
  },
  {
    id: 'CE-4 (parent 2)',
    title: "the parent's count does not reach its child",
    rows: [row('1', '1', '0', '0'), row('1.1', '2', '10', '20'), row('1.1.1', '1', '5', '5')],
    bl: '25',
  },
  {
    id: 'CE-4 (parent 2, child 2)',
    title: 'with the child typed 2 as well',
    rows: [row('1', '1', '0', '0'), row('1.1', '2', '10', '20'), row('1.1.1', '2', '5', '10')],
    bl: '30',
  },
  {
    id: 'CE-5',
    title: 'all quantities 1: BL is the sum of the per-piece costs (the worksheet at quantity 1, SPEC section 18.5)',
    rows: [row('1', '1', '3', '3'), row('1.1', '1', '4', '4'), row('1.2', '1', '5', '5')],
    bl: '12',
  },
  {
    id: 'CE-6',
    title: 'a deep chain',
    rows: [row('1', '2', '0', '0'), row('1.1', '6', '1', '6'), row('1.1.1', '30', '1', '30'), row('1.1.1.1', '210', '1', '210')],
    bl: '246',
  },
  {
    id: 'CE-7',
    title: 'the CE-1 tree with Tool Cost 2 on the part and 3 on the sub-part: BL 30 (BN is asserted in the totals test)',
    rows: [row('1', '2', '0', '0'), row('1.1', '6', '1', '6', '2'), row('1.1.1', '24', '1', '24', '3')],
    bl: '30',
  },
  {
    id: 'CE-9 A',
    title: 'a part with H 0: the sub-part still counts (the withdrawn rule gave 0)',
    rows: [row('1', '2', '0', '0'), row('1.1', '0', '1', '0'), row('1.1.1', '24', '1', '24')],
    bl: '24',
  },
  {
    id: 'CE-9 B',
    title: 'A plus a second part under the item',
    rows: [row('1', '2', '0', '0'), row('1.1', '0', '1', '0'), row('1.1.1', '24', '1', '24'), row('1.2', '6', '1', '6')],
    bl: '30',
  },
  {
    id: 'CE-9 C',
    title: 'H 0 on the part and again below it; H 24 below that',
    rows: [row('1', '2', '0', '0'), row('1.1', '0', '1', '0'), row('1.1.1', '0', '1', '0'), row('1.1.1.1', '24', '1', '24')],
    bl: '24',
  },
  {
    id: 'CE-9 D',
    title: "a top-level item with H 0: its own cost goes, the child stays",
    rows: [row('1', '0', '3', '0'), row('1.1', '4', '1', '4')],
    bl: '4',
  },
  {
    id: 'CE-9 E',
    title: 'a part with H 0 and nothing below it; a second part typed 2',
    rows: [row('1', '2', '0', '0'), row('1.1', '0', '1', '0'), row('1.2', '2', '1', '2')],
    bl: '2',
  },
  {
    id: 'CE-9 F',
    title: 'a childless top-level item with H 0, a single-piece product',
    rows: [row('1', '0', '5', '0')],
    bl: '0',
  },
  {
    id: 'CE-9 G',
    title: 'H 0 on the part and below it, nothing below that',
    rows: [row('1', '2', '0', '0'), row('1.1', '0', '1', '0'), row('1.1.1', '0', '1', '0')],
    bl: '0',
  },
  {
    id: 'CE-10',
    title: 'a fractional quantity',
    rows: [row('1', '2', '0', '0'), row('1.1', '0.5', '2', '1'), row('1.1.1', '1.25', '4', '5')],
    bl: '6',
  },
  {
    id: 'CE-12 A',
    title: 'a childless top-level item, H 3 at 5 a piece',
    rows: [row('1', '3', '5', '15')],
    bl: '15',
    wrong: [{ bl: '45', means: "the item's quantity applied to its own row a second time" }],
  },
  {
    id: 'CE-12 B',
    title: 'the same item at H 1 (a sample with quantity 1 on every row cannot tell A from this)',
    rows: [row('1', '1', '5', '5')],
    bl: '5',
  },
  {
    id: 'CE-12 C',
    title: 'two top-level items: X with a child typed 2, and Y as in A',
    rows: [row('1', '2', '0', '0'), row('1.1', '2', '1', '2'), row('2', '3', '5', '15')],
    bl: '17',
    wrong: [{ bl: '47', means: "the item's quantity applied to its own row a second time" }],
  },
  {
    id: 'CE-12 D',
    title: "the delivery lead's own example: quantity 5 at 200 a piece (AQP-14 comment 10510)",
    rows: [row('1', '5', '200', '1000')],
    bl: '1000',
    wrong: [{ bl: '5000', means: "the item's quantity applied to its own row a second time" }],
  },
];

/** The reorder and move of CE-11: the same rows as CE-1 in another order (a move changes Sl. No, not the price). */
export const CE_11_REORDERED: ReadonlyArray<CaseRow> = [row('1.1.1', '24', '1', '24'), row('1', '2', '0', '0'), row('1.1', '6', '1', '6')];
