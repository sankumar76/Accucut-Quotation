import { z } from 'zod';

import { inputEntriesOf } from '@/lib/estimate/part-view';

import { formResponseSchema } from './schemas/form';
import { materialOptionsResponseSchema, treatmentOptionsResponseSchema } from './schemas/options';
import { nodeDetailSchema } from './schemas/tree';

/**
 * The four answers the part form reads (`GET /estimates/{id}/form`, `GET /estimates/{id}/nodes/{nodeId}`, `GET /options/materials`, `GET /options/treatments`), built **in one place**, so the four routes and the
 * Lead's review page (DEF-141: the page hands the same four answers to the form as props, so the browser does not fetch them after hydration) send the same bodies, through the same strict schemas, with no added
 * field (NFR-002). Each function takes what the service answered and returns the schema's own parse of it; a value that nothing declared fails closed, as it does in a route.
 */

export function formBody(form: z.input<typeof formResponseSchema>): z.output<typeof formResponseSchema> {
  return formResponseSchema.parse({ sections: form.sections, lastSavedAt: form.lastSavedAt });
}

/** One part with what was typed into it: `inputs` is a list of field ID and text entries, of fields of the form only (STORY-05.03, review SQR-09). */
export function nodeBody(detail: Omit<z.input<typeof nodeDetailSchema>, 'inputs'> & { readonly inputs: Parameters<typeof inputEntriesOf>[0] }): z.output<typeof nodeDetailSchema> {
  const { inputs, ...part } = detail;
  return nodeDetailSchema.parse({ ...part, inputs: inputEntriesOf(inputs) });
}

export function materialOptionsBody(options: z.input<typeof materialOptionsResponseSchema>['options']): z.output<typeof materialOptionsResponseSchema> {
  return materialOptionsResponseSchema.parse({ options });
}

export function treatmentOptionsBody(options: z.input<typeof treatmentOptionsResponseSchema>['options']): z.output<typeof treatmentOptionsResponseSchema> {
  return treatmentOptionsResponseSchema.parse({ options });
}
