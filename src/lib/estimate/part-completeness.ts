import type { ConfigDocument } from '../fields/schema';

import { createPartReader } from './calculate-check';
import type { Completeness } from './part-view';

/**
 * How complete a part is, by the rule of Calculate (STORY-05.11 AC-2, AC-3; FR-057; FR-055). Pure and server-only: it builds on `createPartReader` of `calculate-check.ts`, which pulls in the whole
 * form definition and the registry, and that must stay out of the page's first load (NFR-009, `/estimates/[code]`). The page counts with `sectionProgress` (`form-values.ts`) and the agreement test
 * (`tests/unit/estimate-completeness-agreement.test.ts`) holds the two together.
 *
 *   - `COMPLETE`: every needed, visible field of the part shows a value, and the part has a material: exactly the parts Calculate does **not** name in a 422 `CALCULATE_BLOCKED`. A part with every
 *     input and no picture is `COMPLETE` (Part Model is optional, D-31), and the picture is never read here.
 *   - `EMPTY`: not complete, and no field that a person types or chooses holds a value. A default that is shown but not stored is nothing typed (Fasteners "None").
 *   - `PARTIAL`: the rest. A part that holds only 0 values is `PARTIAL` (0 is a value).
 *
 * It is read against the **current** configuration, the form the Engineer sees, as Calculate does (assumption A-2); nothing here depends on a rate, a material row or a calculation, and nothing
 * but the word leaves it (NFR-002).
 */
export type CompletenessReader = (inputs: Readonly<Record<string, unknown>>) => Completeness;

const holdsValue = (stored: unknown): boolean => stored !== undefined && stored !== null && stored !== '';

/**
 * A reader for one configuration. The form's fields are worked out once, so the tree of up to 2,000 parts is answered with no query and no second pass over the registry per part (NFR-008,
 * NFR-011): one call of this per answer, then one cheap call per part. The tree, the form's save and a picture change each build one and use it, so the three answer in the same words.
 */
export function createCompletenessReader(document: ConfigDocument): CompletenessReader {
  const reader = createPartReader(document);
  return (inputs) => {
    const { missing, material } = reader.read(inputs);
    if (missing.length === 0 && material !== null) return 'COMPLETE';
    return reader.fieldIds.some((fieldId) => holdsValue(inputs[fieldId])) ? 'PARTIAL' : 'EMPTY';
  };
}
