import { z } from 'zod';

import { inputEntriesOf } from '@/lib/estimate/part-view';

import { formResponseSchema } from './schemas/form';
import { materialOptionsResponseSchema, treatmentOptionsResponseSchema } from './schemas/options';
import { nodeDetailSchema, partsTreeSchema } from './schemas/tree';

/**
 * The answers the part form and the tree read (`GET /estimates/{id}/form`, `GET /estimates/{id}/nodes/{nodeId}`, `GET /options/materials`, `GET /options/treatments` and `GET /estimates/{id}/tree`), built **in one place**, so the routes and the
 * Lead's review page (DEF-141: the page hands the same answers to the form and the island's tree as props, so the browser does not fetch them after hydration) send the same bodies, through the same strict schemas, with no added
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

/** The parts tree as `GET /estimates/{id}/tree` answers it: the rows in reading order, with no figure (NFR-002). **One builder, three users:** the route, the Engineer's page (the tree hook's seed) and the Lead's review page (the tree island's seed) all build it here, through the one strict schema, so a field the schema does not name leaves none of them. */
export function treeBody(tree: ReadonlyArray<z.input<typeof partsTreeSchema>['nodes'][number]>): z.output<typeof partsTreeSchema> {
  return partsTreeSchema.parse({ nodes: [...tree] });
}
