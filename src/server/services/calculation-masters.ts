import { Decimal } from '../../lib/decimal';
import { CUSTOMER_DELETED_CODE, CUSTOMER_DELETED_MESSAGE, MATERIAL_DELETED_CODE, MATERIAL_DELETED_MESSAGE } from '../../lib/estimate/calculate-words';
import { ConflictError, NotFoundError } from '../../lib/errors';
import type { ExchangeValues, MaterialValues } from '../../lib/estimate/row-calculator';
import type { RateValue } from '../../lib/formula';
import type { MasterSnapshot } from '../repositories/calculation-repository';
import type { MasterRepository, MaterialValuesRecord } from '../repositories/master-repository';
import type { Transaction } from '../repositories/transaction';

/**
 * What one calculation reads from the masters (STORY-03.03, 03.05; architecture section 4.2), read **in the caller's transaction and in as few statements as there are masters**
 * (STORY-05.09, review SQR-01 of AQP-293, GitHub issue 382): the customer with its rates, every distinct material in one statement, and the two exchange rates. While Calculate holds the estimate's
 * lock it holds one pooled connection, so a read on another connection would wait for a free one, and ten Calculates at once could each hold one and wait for another until all failed. Passing `tx`
 * takes none. Without `tx` (the calculation alone, `calculateRow` and `calculateEstimate`) the reads are plain.
 *
 * The values are the masters' current ones, as decimal text and as `Decimal`, and nothing is rounded on the way in. A customer or a material that the Admin deleted after a part chose it is a
 * **409** with its own code (`CUSTOMER_DELETED`, `MATERIAL_DELETED`; STORY-02.07, A-13: the row stays under the soft delete), and one that is not there at all is a 404.
 */

export type CalculationMasters = Pick<MasterRepository, 'findCustomerForCalculation' | 'findMaterialsForCalculation' | 'readExchangeRates'>;

/** The masters one calculation reads, once: the customer's rates, each distinct material, and the two exchange rates, as numbers and as the text they were stored as. */
export interface MasterValues {
  readonly rates: ReadonlyArray<RateValue>;
  readonly materials: ReadonlyMap<string, MaterialValues>;
  readonly exchange: ExchangeValues;
  /** The same values as stored text, with the names then: the master snapshot of a stored record is built from these, so it is what the calculation used. */
  readonly snapshot: MasterSnapshot;
  /** Each material's record, for the words of E and F. */
  readonly materialRecords: ReadonlyMap<string, MaterialValuesRecord>;
}

const NOT_FOUND_MESSAGE = 'The customer or the material was not found.';

const decimalOrNull = (text: string | null): Decimal | null => (text === null ? null : new Decimal(text));

/** The distinct materials by the ID that was asked for, in the order of first use: a deleted one is the 409, one that is not there is the 404. */
async function readMaterials(masters: CalculationMasters, materialIds: ReadonlyArray<string>, tx?: Transaction): Promise<ReadonlyMap<string, MaterialValuesRecord>> {
  const found = new Map((await masters.findMaterialsForCalculation(materialIds, tx)).map((record) => [record.id.toLowerCase(), record]));
  const records = new Map<string, MaterialValuesRecord>();
  for (const id of materialIds) {
    const record = found.get(id.toLowerCase());
    if (record === undefined) throw new NotFoundError(NOT_FOUND_MESSAGE);
    if (record.deleted) throw new ConflictError(MATERIAL_DELETED_MESSAGE, { code: MATERIAL_DELETED_CODE });
    records.set(id, record);
  }
  return records;
}

export async function readMasters(masters: CalculationMasters, customerId: string, materialIds: ReadonlyArray<string>, tx?: Transaction): Promise<MasterValues> {
  const found = await masters.findCustomerForCalculation(customerId, tx);
  if (found === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (found.deleted) throw new ConflictError(CUSTOMER_DELETED_MESSAGE, { code: CUSTOMER_DELETED_CODE });
  const { customer } = found;
  const materialRecords = await readMaterials(masters, materialIds, tx);
  const exchange = await masters.readExchangeRates(tx);
  return {
    rates: customer.rates.map((rate) => ({ id: rate.processItemId, name: rate.name, value: new Decimal(rate.value) })),
    materials: new Map(
      [...materialRecords].map(([id, material]) => [
        id,
        { pricePerKg: new Decimal(material.pricePerKg), specificGravity: new Decimal(material.specificGravity), scrapRate: new Decimal(material.scrapRate) },
      ]),
    ),
    exchange: { usd: decimalOrNull(exchange.usd), eur: decimalOrNull(exchange.eur) },
    materialRecords,
    snapshot: {
      customer: { id: customer.id, name: customer.name },
      rates: customer.rates.map((rate) => ({ id: rate.processItemId, name: rate.name, value: rate.value })),
      // In the order the materials were first used, so the same tree gives the same snapshot.
      materials: materialIds.map((id) => {
        const record = materialRecords.get(id);
        if (record === undefined) throw new NotFoundError(NOT_FOUND_MESSAGE);
        return {
          id: record.id,
          materialInDrawing: record.materialInDrawing,
          materialConsidered: record.materialConsidered,
          pricePerKg: record.pricePerKg,
          specificGravity: record.specificGravity,
          scrapRate: record.scrapRate,
        };
      }),
      exchangeRates: { usd: exchange.usd, eur: exchange.eur },
    },
  };
}
