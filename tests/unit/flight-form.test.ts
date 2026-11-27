import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { hookSource, rewriteFlightText, type FormBody } from '../e2e/support/flight-form';

/**
 * DEF-085 (DL-469, DL-470 (2) (iii)): the helper that adds a card to the form body that the Engineer's page carries in its flight data, for `tests/e2e/estimate-form-choice.spec.ts`. **It must be loud**: it throws
 * unless it found and rewrote exactly one body, so a change in Next's payload turns the E2E cases red and never leaves them green for nothing. Two halves are tested: the rewriting of the joined flight text
 * (`rewriteFlightText`), and the hook that runs in the page (`hookSource`: held until the document is loaded, then handed to Next's client in order), run here in a `vm` context that behaves as the page does. The sample
 * text is made by React's own flight serialiser, the one Next uses (`tests/support/flight-sample.cjs`, run under `--conditions=react-server`), so no captured file is needed. Invented names only.
 */

const SECTION = { id: 's1', number: 1, name: 'A "quoted" <b>name</b> & more', shortName: 'Part', columnRange: 'A to C', fields: [{ id: 'f1', letter: 'A', label: 'Field a' }] };
const FORM = { sections: [SECTION], lastSavedAt: '2026-11-27T10:00:00.000Z' };
const ADDED = { id: 's9', number: 9, name: 'Invented Finishing', shortName: 'Finishing', columnRange: 'AY', fields: [] };

/** The flight text React's serialiser makes for a model. */
function flightOf(model: unknown): string {
  return execFileSync(process.execPath, ['--conditions=react-server', 'tests/support/flight-sample.cjs', JSON.stringify(model)], { encoding: 'utf8' });
}

const addCard = (form: FormBody): FormBody => ({ ...form, sections: [...form.sections, ADDED] });
const sample = (): string => flightOf({ seed: { estimateId: 'e', partId: 'p', form: FORM, part: { id: 'p', inputs: [] } }, other: 'x' });
const rowOf = (text: string): { seed: { estimateId: string; form: FormBody; part: unknown }; other: string } => JSON.parse((text.split('\n').find((line) => line.startsWith('0:')) ?? '').slice(2)) as never;

describe('rewriteFlightText: the one form body in the flight text', () => {
  it('adds the card to the body and leaves every other value as it was', () => {
    const model = rowOf(rewriteFlightText(sample(), addCard));
    expect(model.seed.form.sections.map((section) => section['id'])).toEqual(['s1', 's9']);
    expect(model.seed.form.sections[0]).toEqual(SECTION);
    expect(model.seed.form.lastSavedAt).toBe(FORM.lastSavedAt);
    expect(model.seed.estimateId).toBe('e');
    expect(model.seed.part).toEqual({ id: 'p', inputs: [] });
    expect(model.other).toBe('x');
  });

  it('is loud: it throws when no body has the form\'s shape (a body referenced instead of inlined, or a payload that changed)', () => {
    expect(() => rewriteFlightText('0:{"seed":{"estimateId":"e","form":"$1"}}\n1:{"other":true}\n', addCard)).toThrow(/exactly one form body.*found 0/);
    expect(() => rewriteFlightText(flightOf({ seed: { form: { sections: [SECTION] } } }), addCard)).toThrow(/found 0/);
    expect(() => rewriteFlightText('', addCard)).toThrow(/found 0/);
  });

  it('is loud: it throws when two bodies are sent (the form twice), because it cannot know which one the page uses', () => {
    expect(() => rewriteFlightText(flightOf({ seed: { form: FORM }, again: { form: FORM } }), addCard)).toThrow(/found 2/);
  });

  it('is loud: it throws when the change adds nothing, so a case cannot pass on an untouched page', () => {
    expect(() => rewriteFlightText(sample(), (form) => form)).toThrow(/changed nothing/);
  });
});

/** A page as the hook sees it: `self` is the global object, `document` has a ready state and listeners, and Next's client is played by the test. */
function pageOf(readyState: 'loading' | 'complete' = 'loading') {
  const listeners: Array<() => void> = [];
  const sandbox: Record<string, unknown> = { document: { readyState, addEventListener: (_event: string, listener: () => void) => listeners.push(listener) }, structuredClone };
  sandbox['self'] = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(hookSource(ADDED), context);
  const flight = (): { push: (item: unknown[]) => void } & unknown[] => vm.runInContext('self.__next_f', context) as never;
  return {
    flight,
    /** The page's inline scripts: the bootstrap and the chunks. */
    push: (...items: unknown[][]) => items.forEach((item) => flight().push(item)),
    /** The document finishes loading. */
    load: () => listeners.forEach((listener) => listener()),
    /** What Next's client does when it starts: reads what was collected, then takes over `push`. */
    nextStarts: (): { read: unknown[][]; later: unknown[][] } => {
      const read = [...flight()] as unknown[][];
      flight().length = 0;
      const later: unknown[][] = [];
      flight().push = (item: unknown[]) => void later.push(item);
      return { read, later };
    },
    flag: (): unknown => vm.runInContext('self.__flightFormRewrite', context),
  };
}

describe('the hook: held until the document is loaded, then handed to Next in order, rewritten', () => {
  const text = sample();

  it('collects the chunks, and when the document has loaded Next reads the bootstrap, then one rewritten text chunk, then the other chunks, in their order', () => {
    const page = pageOf();
    page.push([0], [1, text.slice(0, 40)], [1, text.slice(40)], [3, 'YmluYXJ5']);
    expect([...page.flight()]).toEqual([]);
    page.load();
    const { read } = page.nextStarts();
    expect(read.map((item) => item[0])).toEqual([0, 1, 3]);
    expect(rowOf(read[1]?.[1] as string).seed.form.sections.map((section) => section['id'])).toEqual(['s1', 's9']);
    expect(read[2]).toEqual([3, 'YmluYXJ5']);
    expect(page.flag()).toBe('rewrote');
  });

  it('hands the chunks to Next\'s own callback when Next started before the document loaded, in the same order, and hands later chunks on unchanged', () => {
    const page = pageOf();
    page.push([0], [1, text]);
    const { read, later } = page.nextStarts();
    expect(read).toEqual([]);
    page.load();
    expect(later.map((item) => item[0])).toEqual([0, 1]);
    expect(rowOf(later[1]?.[1] as string).seed.form.sections).toHaveLength(2);
    page.push([1, '9:"late"\n']);
    expect(later[2]).toEqual([1, '9:"late"\n']);
  });

  it('is loud and changes nothing when the body is not there: the error is logged and left in the page, and the chunks go through as they came', () => {
    const page = pageOf();
    page.push([0], [1, '0:{"seed":{"form":"$1"}}\n']);
    page.load();
    const { read } = page.nextStarts();
    expect(read).toEqual([[0], [1, '0:{"seed":{"form":"$1"}}\n']]);
    expect(String(page.flag())).toMatch(/exactly one form body/);
  });

  it('takes no part in a page that never sends flight text', () => {
    const bare = pageOf();
    bare.push([0]);
    bare.load();
    expect(bare.nextStarts().read).toEqual([[0]]);
    expect(bare.flag()).toBeUndefined();
  });
});
