import { Decimal, type Value } from '../../src/lib/decimal';
import { calculateProductTotals } from '../../src/lib/estimate/product-totals';
import { calculateRowOutputs } from '../../src/lib/estimate/row-calculator';
import { storeRowOutputs, type StoredRowOutputs } from '../../src/lib/estimate/row-outputs';
import { findFieldById } from '../../src/lib/fields/registry';
import type { ConfigDocument } from '../../src/lib/fields/schema';
import type { CompiledPlan } from '../../src/lib/formula';
import type { MasterSnapshot } from '../../src/server/repositories/calculation-repository';

import { defined } from './defined';

/**
 * Re-evaluates a stored calculation from the record alone (GitHub #432, architecture section 4.2, test 3): the master snapshot, each row's stored `inputs` and the plan of the record's configuration
 * version. Nothing is read from the masters. Used by the unit test and the PostgreSQL test of the snapshot, so the two prove the same thing. Every value is invented.
 */

export interface RecordToReevaluate {
  readonly masterSnapshot: MasterSnapshot;
  readonly rows: ReadonlyArray<{ readonly inputs: Readonly<Record<string, string | null>> }>;
}

export interface Reevaluated {
  readonly rows: ReadonlyArray<StoredRowOutputs>;
  readonly productValues: { readonly totalPrice: string | null; readonly pricePerToolCost: string | null; readonly toolCostTotal: string | null };
}

const decimalOrNull = (text: string | null): Value => (text === null ? null : new Decimal(text));

/** The typed numbers and flags of a stored row: the stored words (E, F, G and the rest) are not typed values. */
function typedOf(document: ConfigDocument, inputs: Readonly<Record<string, string | null>>): Map<string, Value> {
  const typed = new Map<string, Value>();
  for (const [fieldId, text] of Object.entries(inputs)) {
    const field = findFieldById(document, fieldId);
    if (field?.kind === 'input' && (field.dataType === 'number' || field.dataType === 'flag') && text !== null) typed.set(fieldId, new Decimal(text));
  }
  return typed;
}

export function reevaluateRecord(record: RecordToReevaluate, document: ConfigDocument, plan: CompiledPlan, materialIdField: string): Reevaluated {
  const { masterSnapshot } = record;
  const rates = masterSnapshot.rates.map((rate) => ({ id: rate.id, name: rate.name, value: new Decimal(rate.value) }));
  const exchange = { usd: decimalOrNull(masterSnapshot.exchangeRates.usd), eur: decimalOrNull(masterSnapshot.exchangeRates.eur) };
  const rows = record.rows.map((row) => {
    const material = defined(masterSnapshot.materials.find((candidate) => candidate.materialInDrawing === row.inputs[materialIdField]), 'the row\'s material in the snapshot');
    const inputs = typedOf(document, row.inputs);
    const outputs = calculateRowOutputs({
      document,
      plan,
      inputs,
      rates,
      material: { pricePerKg: new Decimal(material.pricePerKg), specificGravity: new Decimal(material.specificGravity), scrapRate: new Decimal(material.scrapRate) },
      exchange,
    });
    return { inputs, outputs };
  });
  const totals = calculateProductTotals({ document, plan, rows });
  return {
    rows: rows.map((row) => storeRowOutputs(row.outputs)),
    productValues: {
      totalPrice: totals.totalPrice?.toString() ?? null,
      pricePerToolCost: totals.pricePerToolCost?.toString() ?? null,
      toolCostTotal: totals.toolCostTotal?.toString() ?? null,
    },
  };
}
