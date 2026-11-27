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
 * **This file is Restricted with the review**: `page.tsx` loads it with the review for a Lead and an Admin only, and the Engineer's page imports none of it.
 *
 * A fault in any of the reads is not a fault of the page: the form then gets no seed and reads from the server, as it did before, and says so in its own notice if that fails too. The kind of the fault is logged,
 * never its cause or the estimate (no personal data).
 */

export interface SeedServices {
  readonly estimates: Pick<EstimateService, 'getForm' | 'getNode'>;
  readonly masters: Pick<MastersService, 'listMaterialOptions' | 'listTreatmentOptions'>;
}

/** The three answers that do not depend on the row: the form's definition and the two lists. `null` when any could not be read. */
export interface FormBodies {
  readonly form: unknown;
  readonly materials: unknown;
  readonly treatments: unknown;
}

function logFault(what: string, error: unknown): void {
  logger.warn({ errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined }, `The ${what} could not be read for the part form; the form reads it itself.`);
}

export async function readFormBodies(services: SeedServices, viewer: EstimateViewer, estimateId: string): Promise<FormBodies | null> {
  try {
    const [form, materials, treatments] = await Promise.all([services.estimates.getForm(viewer, estimateId), services.masters.listMaterialOptions(), services.masters.listTreatmentOptions()]);
    return { form: formBody(form), materials: materialOptionsBody(materials), treatments: treatmentOptionsBody(treatments) };
  } catch (error) {
    logFault('form definition and option lists', error);
    return null;
  }
}

/** The part's body, as `GET /estimates/{id}/nodes/{nodeId}` answers. `null` when it could not be read. */
export async function readPartBody(services: SeedServices, viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<unknown> {
  try {
    return nodeBody(await services.estimates.getNode(viewer, estimateId, nodeId));
  } catch (error) {
    logFault('part', error);
    return null;
  }
}

/** The seed for the row the review shows, or `undefined` (the form reads from the server) when any answer is missing. */
export function seedOf(estimateId: string, partId: string, bodies: FormBodies | null, part: unknown): PartFormSeed | undefined {
  if (bodies === null || part === null || part === undefined) return undefined;
  return { estimateId, partId, form: bodies.form, part, materials: bodies.materials, treatments: bodies.treatments };
}
