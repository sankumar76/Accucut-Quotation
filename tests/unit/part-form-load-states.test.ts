import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PartForm, type PartFormProps } from '@/components/features/estimate-workspace/part-form';
import { PartFields } from '@/components/features/estimate-workspace/part-fields';
import { FAILED_BODY, FORM_LOAD_FAILED_TITLE, FORM_LOADING, TRY_AGAIN } from '@/components/features/estimate-workspace/estimate-texts';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';

import { renderHook } from '../support/hook-harness';

/**
 * DEF-085 (DL-469, DL-470 (1)): the Engineer's form is handed its data as props, so the browser cannot be made to fail or to wait on `/api/v1/estimates/{id}/form` in the E2E (the route is not read). The three cases of
 * `tests/e2e/estimate-first-load.spec.ts` AC-4 that drove the form's failed and slow states through that route are these cases, one level down. **The real `PartForm` runs with the real `useFormDefinition`, the real
 * response readers and the real fetch wrapper; only the network is stubbed** (`fetch`: failing, then answering; held, then answering). The hooks are React's own state and effects as the hook harness gives them
 * (`tests/support/hook-harness.ts`: the project has no DOM test library and adds none); the element the form returns is read, and "pressing Try again" is the button's own `onClick`. Invented ids only.
 *
 * Old E2E line to new line (AC-4 of `estimate-first-load.spec.ts`):
 *   case 1, `route.abort` of `/form` -> `fetch` rejects: "We could not load the form" visible -> the returned element is a `Notice` with that title; `partForm` count 0 -> no `PartFields` element; unroute and press
 *   "Try again" -> the button's `onClick` with the network answering; the form shown and the notice gone -> a `PartFields` element with the definition the answer carried, and no `Notice`.
 *   case 2, `/form` delayed -> `fetch` held: the status "Loading the form" visible -> the returned element is `role="status"` named "Loading the form"; then the form and no status -> after the answer, a `PartFields`
 *   element and no status.
 *   case 3 (the held `/nodes/{id}` read) stays an E2E case, on the unseeded second row.
 *   Added (DL-470 (1) (d)): a page whose reads failed hands no seed, and then the form reads from the network, both the definition and the materials.
 */

vi.mock('react', async (importOriginal) => {
  const { reactHooks } = await import('../support/hook-harness');
  return { ...(await importOriginal<typeof import('react')>()), useState: reactHooks.useState, useRef: reactHooks.useRef, useEffect: reactHooks.useEffect, useCallback: reactHooks.useCallback, useMemo: reactHooks.useMemo };
});

const ESTIMATE = 'e';
const PART = { id: '00000000-0000-4000-8000-0000000000e1', slNo: '1', revision: 1 };
const FIELD = { id: 'a', letter: 'A', label: 'Field a', kind: 'input', unit: null, hint: null, defaultValue: null, required: true, editable: true, visibleWhen: null, rule: { type: 'number', decimals: 2 } };
const FORM_BODY = { sections: [{ id: 's1', number: 1, name: 'Part details', shortName: 'Part', columnRange: 'A to C', fields: [FIELD] }], lastSavedAt: '2026-11-27T10:00:00.000Z' };
const MATERIALS_BODY = { options: [{ id: 'm1', name: 'Invented steel', materialConsidered: 'Steel' }] };

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Node {
  readonly type?: unknown;
  readonly props?: { readonly children?: unknown; readonly [key: string]: unknown };
}

/** Every element in what the form returned, depth first, without rendering any component: only the elements the form itself made. */
function elementsOf(root: unknown): Node[] {
  const found: Node[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== 'object' || value === null) return;
    const node = value as Node;
    if (node.props === undefined) return;
    found.push(node);
    walk(node.props.children);
  };
  walk(root);
  return found;
}
const ofType = (root: unknown, type: unknown): Node[] => elementsOf(root).filter((node) => node.type === type);

const network = { form: vi.fn(), materials: vi.fn() };

beforeEach(() => {
  network.form.mockReset();
  network.materials.mockReset();
  vi.stubGlobal('fetch', (input: unknown) => {
    const url = String(input);
    if (url.endsWith('/form')) return network.form();
    if (url.endsWith('/options/materials')) return network.materials();
    return Promise.reject(new Error(`an unexpected read: ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const props = (over: Partial<PartFormProps> = {}): PartFormProps => ({ estimateId: ESTIMATE, part: PART, editable: true, nodes: null, ...over });
const rendered = (given: PartFormProps) => renderHook((current: PartFormProps) => PartForm(current), given);

describe('AC-4 case 1 (was the E2E case): when the fields cannot be fetched the notice offers "Try again", and pressing it brings the fields', () => {
  it('shows the notice with its words and a Try again button, no fields, and then the fields after pressing it with the network answering', async () => {
    network.form.mockRejectedValue(new TypeError('network down'));
    network.materials.mockResolvedValue(json(MATERIALS_BODY));
    const view = rendered(props());
    view.render();
    await flush();
    const failed = view.render();
    const notice = ofType(failed, Notice);
    expect(notice).toHaveLength(1);
    expect(notice[0]?.props?.['title']).toBe(FORM_LOAD_FAILED_TITLE);
    expect(JSON.stringify(elementsOf(failed).flatMap((node) => (typeof node.props?.children === 'string' ? [node.props.children] : [])))).toContain(FAILED_BODY);
    expect(ofType(failed, PartFields)).toHaveLength(0);
    const buttons = ofType(failed, Button);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props?.children).toBe(TRY_AGAIN);

    // The network is back: pressing the button reads the form again, and the fields take the notice's place.
    network.form.mockResolvedValue(json(FORM_BODY));
    network.materials.mockResolvedValue(json(MATERIALS_BODY));
    (buttons[0]?.props?.['onClick'] as () => void)();
    view.render();
    await flush();
    await flush();
    const after = view.render();
    expect(ofType(after, Notice)).toHaveLength(0);
    const fields = ofType(after, PartFields);
    expect(fields).toHaveLength(1);
    expect((fields[0]?.props?.['form'] as { sections: ReadonlyArray<{ name: string }> }).sections[0]?.name).toBe('Part details');
    expect(network.form).toHaveBeenCalledTimes(2);
  });
});

describe('AC-4 case 2 (was the E2E case): while the fields are on their way the skeleton shows as a status, then the fields take its place', () => {
  it('is a status named "Loading the form" while the form is held, and the fields without the status once it answers', async () => {
    let answer: () => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      answer = () => resolve(json(FORM_BODY));
    });
    network.form.mockReturnValue(held);
    network.materials.mockResolvedValue(json(MATERIALS_BODY));
    const view = rendered(props());
    view.render();
    await flush();
    const waiting = view.render();
    const status = elementsOf(waiting).filter((node) => node.props?.['role'] === 'status');
    expect(status).toHaveLength(1);
    expect(status[0]?.props?.['aria-label']).toBe(FORM_LOADING);
    expect(ofType(waiting, PartFields)).toHaveLength(0);

    answer();
    await flush();
    await flush();
    view.render();
    const after = view.render();
    expect(elementsOf(after).filter((node) => node.props?.['role'] === 'status')).toHaveLength(0);
    expect(ofType(after, PartFields)).toHaveLength(1);
  });
});

describe('DL-470 (1) (d): a page whose reads failed gives no seed, and then the form reads from the network', () => {
  it('reads the definition and the materials when there is no seed, and neither when the page handed over a good one', async () => {
    network.form.mockResolvedValue(json(FORM_BODY));
    network.materials.mockResolvedValue(json(MATERIALS_BODY));
    rendered(props({ seed: undefined })).render();
    await flush();
    expect(network.form).toHaveBeenCalledTimes(1);
    expect(network.materials).toHaveBeenCalledTimes(1);

    network.form.mockClear();
    network.materials.mockClear();
    const seed: PartFormSeed = { estimateId: ESTIMATE, partId: PART.id, form: FORM_BODY, part: { id: PART.id }, materials: MATERIALS_BODY, treatments: { options: [] } };
    rendered(props({ seed })).render();
    await flush();
    expect(network.form).not.toHaveBeenCalled();
    expect(network.materials).not.toHaveBeenCalled();
  });
});

describe('DEF-085: the seed\'s part values are for the first showing of that part only (the Engineer edits)', () => {
  const OTHER = { id: '00000000-0000-4000-8000-0000000000e2', slNo: '2', revision: 1 };
  const SEED: PartFormSeed = { estimateId: ESTIMATE, partId: PART.id, form: FORM_BODY, part: { id: PART.id }, materials: MATERIALS_BODY, treatments: { options: [] } };
  const seedOfFields = (element: unknown): PartFormSeed | undefined => ofType(element, PartFields)[0]?.props?.['seed'] as PartFormSeed | undefined;

  it('hands the fields the whole seed while the seeded part (or no part yet) is the one shown, and the seed without its part body once another part was shown, even when the first is chosen again', async () => {
    const given: { -readonly [K in keyof PartFormProps]: PartFormProps[K] } = { ...props({ seed: SEED, part: null }) };
    const view = rendered(given);
    view.render();
    await flush();
    await flush();
    // The tree has not answered: the form has no part; then the tree names the seeded part: the fields get the whole seed.
    given.part = PART;
    view.render();
    await flush();
    expect(seedOfFields(view.render())).toBe(SEED);
    // Another part is chosen: its fields read their values from the server (the seed names the first part), and the first part's body is out of the seed from then on.
    given.part = OTHER;
    view.render();
    expect(seedOfFields(view.render())?.part).toBeNull();
    given.part = PART;
    view.render();
    const back = seedOfFields(view.render());
    expect(back?.part, 'the first part, chosen again, is read from the server and not shown from the page\'s old snapshot').toBeNull();
    expect(back?.partId).toBe(PART.id);
    expect(back?.form).toBe(SEED.form);
    expect(back?.materials).toBe(SEED.materials);
  });
});
