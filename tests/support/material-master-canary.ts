import { defined } from './defined';

/**
 * The invented Material Master rows that STORY-02.03 puts into the cost-confidentiality scan (AC-6; BR-003, NFR-001, NFR-002, test
 * strategy section 6): materials with distinctive prices, specific gravities and Material-Scrap-Rates that no other test uses, so that
 * finding one in what an Engineer was sent can only mean a rate leaked. They follow the invented pattern `n.37` or `n.73` (ADR-014);
 * none is a rate of Accucut's and none comes from the sample workbook.
 *
 * This file is the single definition of these values and their IDs. `canaryMasters` (`tests/support/canary-masters.ts`) takes the numbers
 * from here, the E2E database gets the rows through `ensureCanaryMaterials` (`tests/e2e/support/auth.ts`), and the in-memory repository of
 * the security tests is seeded with them (`tests/support/session-harness.ts`).
 *
 * The NAMES of these materials are not forbidden strings: the estimate form's list shows Material in Drawing and Material Considered to
 * every role (AC-4), so an Engineer is rightly sent them. Only the three numbers of each row are Restricted.
 */

export interface MaterialCanary {
  readonly id: string;
  readonly materialInDrawing: string;
  readonly materialConsidered: string;
  readonly pricePerKg: string;
  readonly specificGravity: string;
  readonly scrapRate: string;
}

/**
 * Two rows. The first price has six digits before the point and the second seven, so the lakh and crore groupings of the Indian
 * number format are exercised. Fixed IDs, so a recipe in `route-calls.ts` can name a material that exists in every database the scan reads.
 */
export const MATERIAL_CANARIES: ReadonlyArray<MaterialCanary> = [
  {
    id: '00000000-0000-4000-8000-000500000c01',
    materialInDrawing: 'Canary-Material-Alpha',
    materialConsidered: 'Canary-Considered-Alpha',
    pricePerKg: '917373.37',
    specificGravity: '737.37',
    scrapRate: '717.37',
  },
  {
    id: '00000000-0000-4000-8000-000500000c02',
    materialInDrawing: 'Canary-Material-Beta',
    materialConsidered: 'Canary-Considered-Beta',
    pricePerKg: '9173737.73',
    specificGravity: '757.73',
    scrapRate: '727.73',
  },
];

/** The material a recipe for `PATCH /api/v1/materials/{id}` names: it exists wherever the canaries are loaded. */
export const MATERIAL_RECIPE_ID: string = defined(MATERIAL_CANARIES[0]).id;
