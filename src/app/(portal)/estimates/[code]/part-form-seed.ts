import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import type { MastersService } from '@/server/services/masters-service';
import type { EstimateService, EstimateViewer } from '@/server/services/estimate-service';
import { formBody, materialOptionsBody, nodeBody, treatmentOptionsBody } from '@/server/views/part-form-bodies';

/**
 * What the Lead's review page hands to the part form as props (DEF-141, DL-455): the four answers the form used to fetch from the browser after hydration, which cost four round trips on every Lead page, queued
 * ahead of the person's first press. They are read **from the same services, as the same viewer, and built by the same code as the routes they replace** (`part-form-bodies.ts`: the same strict schemas, so the same
 * shapes and no added field), so the role checks are the routes' own: an Admin and a Lead read any estimate, and the form definition, the materials and the treatments carry no rate, cost or formula (NFR-002).
 * **This file holds no Restricted data** (the four answers carry no rate, cost or formula); it lives beside `review-page.tsx`, which is its only importer, and `page.tsx` loads that for a Lead and an Admin only, so the Engineer's page never reads from it.
 *
 * A fault in any of the reads is not a fault of the page: the form then gets no seed and reads from the server, as it did before, and says so in its own notice if that fails too. The kind of the fault is logged,
 * never its cause or the estimate (no personal data).
 */

export interface SeedServices {
  readonly estimates: Pick<EstimateService, 'getPartForm'>;
  readonly masters: Pick<MastersService, 'listMaterialOptions' | 'listTreatmentOptions'>;
}

/** The two answers that do not depend on the row: the two option lists. */
export interface ListBodies {
  readonly materials: unknown;
  readonly treatments: unknown;
}

/** The two answers of the row: the form's definition and the part. */
export interface PartFormBodies {
  readonly form: unknown;
  readonly part: unknown;
}

function logFault(what: string, error: unknown): void {
  logger.warn({ errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined }, `The ${what} could not be read for the part form; the form reads it itself.`);
}

/** The two option lists, read beside the figures. `null` when either could not be read. */
export async function readListBodies(services: SeedServices): Promise<ListBodies | null> {
  try {
    const [materials, treatments] = await Promise.all([services.masters.listMaterialOptions(), services.masters.listTreatmentOptions()]);
    return { materials: materialOptionsBody(materials), treatments: treatmentOptionsBody(treatments) };
  } catch (error) {
    logFault('option lists', error);
    return null;
  }
}

/**
 * The form's definition and the part's values for the row, from **one** service call (`getPartForm`: exactly what `getForm` and `getNode` answer for this viewer, with one access check, one read of the configuration and
 * one listing of the parts instead of two of each). `null` when it could not be read.
 */
export async function readPartFormBodies(services: SeedServices, viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<PartFormBodies | null> {
  try {
    const { form, node } = await services.estimates.getPartForm(viewer, estimateId, nodeId);
    return { form: formBody(form), part: nodeBody(node) };
  } catch (error) {
    logFault('form definition and part', error);
    return null;
  }
}

/** The seed for the row the review shows, or `undefined` (the form reads from the server) when any answer is missing. */
export function seedOf(estimateId: string, partId: string, lists: ListBodies | null, row: PartFormBodies | null): PartFormSeed | undefined {
  if (lists === null || row === null) return undefined;
  return { estimateId, partId, form: row.form, part: row.part, materials: lists.materials, treatments: lists.treatments };
}
