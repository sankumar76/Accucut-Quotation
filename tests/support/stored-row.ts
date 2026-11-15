import { Decimal } from '../../src/lib/decimal';
import { calculateRowOutputs } from '../../src/lib/estimate/row-calculator';
import { storeRowOutputs } from '../../src/lib/estimate/row-outputs';
import { findFieldByKey } from '../../src/lib/fields/registry';
import { MATERIAL_IN_DRAWING_KEY } from '../../src/lib/fields/types';
import { compilePlan, type CompiledPlan } from '../../src/lib/formula';
import { NOT_APPLICABLE_NAME } from '../../src/lib/masters/system-entries';
import type { MasterSnapshot } from '../../src/server/repositories/calculation-repository';

import { defined } from './defined';
import { EXCHANGE, MATERIAL, NOT_APPLICABLE, ROW, TYPED_RATES } from './row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from './seed-config';

/**
 * A stored row as the calculation record keeps it (STORY-06.03), made by the real row calculator over the invented row of `row-oracle.ts` (whose figures were worked by hand): the row's `inputs` (the
 * typed numbers by field ID as text, and the words of Material in Drawing as they were then), its `outputs` (M to BK as decimal text) and the master snapshot of the calculation. Used by the unit tests of the
 * working, of the cost details service and of the screen, so all three read one record. Every name, ID and number is invented (ADR-014).
 */

export const SEED_PLAN: CompiledPlan = compilePlan(seedConfig.fields);

/** The words of the ordinary material of the invented row. */
export const INVENTED_MATERIAL_WORDS = 'Invented-sheet-grade';

const MATERIAL_ID = '00000000-0000-4000-8000-0000000b0001';
const NOT_APPLICABLE_MATERIAL_ID = '00000000-0000-4000-8000-000500000001';
const CUSTOMER_ID = '00000000-0000-4000-8000-0000000c0001';

export interface StoredRowOptions {
  /** The typed values by SPEC letter; the oracle's row when absent. */
  readonly row?: Readonly<Record<string, string>>;
  /** The material's three numbers, or `'not-applicable'` for the hidden zero row; the oracle's material when absent. */
  readonly material?: { readonly pricePerKg: string; readonly specificGravity: string; readonly scrapRate: string } | 'not-applicable';
  readonly exchange?: { readonly usd: string | null; readonly eur: string | null };
  /** Rates typed by name over the oracle's. */
  readonly rates?: Readonly<Record<string, string>>;
}

export interface StoredRow {
  readonly inputs: Record<string, string | null>;
  readonly outputs: Record<string, string | null>;
  readonly snapshot: MasterSnapshot;
}

const materialFieldId = (): string => defined(findFieldByKey(seedConfig, MATERIAL_IN_DRAWING_KEY)).id;
const decimalOrNull = (text: string | null): Decimal | null => (text === null ? null : new Decimal(text));

export function storedRowOf(options: StoredRowOptions = {}): StoredRow {
  const row = options.row ?? ROW;
  const notApplicable = options.material === 'not-applicable';
  const numbers = notApplicable ? NOT_APPLICABLE : (options.material ?? MATERIAL);
  const exchange = options.exchange ?? EXCHANGE;
  const rates = { ...TYPED_RATES, ...options.rates };
  const words = notApplicable ? NOT_APPLICABLE_NAME : INVENTED_MATERIAL_WORDS;
  const typed = Object.entries(row).map(([letter, text]) => [seedFieldAt(letter).id, text] as const);
  const outputs = storeRowOutputs(
    calculateRowOutputs({
      document: seedConfig,
      plan: SEED_PLAN,
      inputs: new Map(typed.map(([id, text]) => [id, new Decimal(text)])),
      rates: SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: new Decimal(defined(rates[item.name], item.name)) })),
      material: { pricePerKg: new Decimal(numbers.pricePerKg), specificGravity: new Decimal(numbers.specificGravity), scrapRate: new Decimal(numbers.scrapRate) },
      exchange: { usd: decimalOrNull(exchange.usd), eur: decimalOrNull(exchange.eur) },
    }),
  );
  return {
    inputs: { ...Object.fromEntries(typed), [materialFieldId()]: words },
    outputs: { ...outputs },
    snapshot: {
      customer: { id: CUSTOMER_ID, name: 'Invented Customer' },
      rates: SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: defined(rates[item.name], item.name) })),
      materials: [
        {
          id: notApplicable ? NOT_APPLICABLE_MATERIAL_ID : MATERIAL_ID,
          materialInDrawing: words,
          materialConsidered: null,
          pricePerKg: numbers.pricePerKg,
          specificGravity: numbers.specificGravity,
          scrapRate: numbers.scrapRate,
        },
      ],
      exchangeRates: { usd: exchange.usd, eur: exchange.eur },
    },
  };
}
