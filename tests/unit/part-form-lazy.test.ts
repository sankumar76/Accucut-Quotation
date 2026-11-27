import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PartForm, type PartFormProps } from '@/components/features/estimate-workspace/part-form';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * AQP-339 AC-4: `PartForm` loads `PartFields` through `useLazyComponent`, asked for as soon as the form is on the page, and shows the existing skeleton (`role="status"`, label "Loading the
 * form") until the fields' code and the form's definition have both arrived. Rendered to markup with no browser, which is the first paint: nothing has arrived yet. The arrival, the failure and
 * "Try again" need a browser (a chunk that is blocked): `tests/e2e/estimate-form.spec.ts`, in CI at the three widths. The first-load graph is held by `overlay-imports.test.ts`.
 */

const PART_FORM = join(__dirname, '..', '..', 'src', 'components', 'features', 'estimate-workspace', 'part-form.tsx');

const props = (overrides: Partial<PartFormProps> = {}): PartFormProps => ({
  estimateId: '00000000-0000-4000-8000-000000000001',
  part: { id: '00000000-0000-4000-8000-0000000000a1', slNo: '1', revision: 1 },
  editable: true,
  nodes: null,
  onSaved: () => undefined,
  onChanged: () => undefined,
  onNamed: () => undefined,
  onServerIgnored: () => undefined,
  missing: new Set<string>(),
  gate: createSaveGate(),
  ...overrides,
});

describe('PartForm loads the fields lazily (AQP-339 AC-4)', () => {
  it('shows the loading skeleton, announced as a status, until the fields and the definition have arrived', () => {
    const markup = renderToStaticMarkup(createElement(PartForm, props()));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Loading the form"');
    expect(markup).not.toContain('data-part-form');
  });

  it('shows the sentence, not the skeleton, while no part is chosen', () => {
    const markup = renderToStaticMarkup(createElement(PartForm, props({ part: null })));
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain('data-part-form');
  });

  it('imports the fields as a type and by import() only, never with a plain import', () => {
    const source = readFileSync(PART_FORM, 'utf8');
    expect(source).toMatch(/import type \{ PartFieldsProps \} from '\.\/part-fields'/);
    expect(source).toMatch(/import\('\.\/part-fields'\)/);
    expect(source).not.toMatch(/^import \{[^}]*\} from '\.\/part-fields'/m);
    expect(source).toMatch(/useLazyComponent<PartFieldsProps>\(loadFields, true\)/);
  });
});
