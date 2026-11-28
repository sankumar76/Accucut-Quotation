import type { Page } from '@playwright/test';

/**
 * Adds a card to the part form's definition as the Engineer's page carries it, for the E2E cases whose subject is a form the real registry does not have (DEF-085, DL-469, DL-470 (2) (iii)).
 *
 * Why it exists: the Engineer's page hands its form the definition as a prop (`seed.form`, the body `GET /estimates/{id}/form` answers), so it no longer reads `/form` from the browser, and a case can no longer
 * change what the form shows by answering that route itself. The registry is shared by all three projects and its versions are global, so a case cannot add a field for real either. What is left is the prop as it
 * travels: the server component's props are serialised into the page's `self.__next_f.push([1, "..."])` scripts (the flight data), where the seed is plain inline JSON.
 *
 * How: not by answering the document (a document that the test fulfils is treated by the browser as coming from another address space, and its own requests to the server are then blocked, so the page never starts),
 * but by an init script that sits where Next's client reads the flight data: it holds the chunks until the document is loaded, joins the text, rewrites the one form body, and hands Next the whole as the first chunk,
 * in order. The finding is **by the body's own shape** (`sections` and `lastSavedAt`), never by a chunk id, a module path or a row number, so a change of the bundler's references does not matter.
 *
 * Loud on purpose: `rewriteFlightText` throws unless it found and rewrote exactly one body; in the page the error is left in `self.__flightFormRewrite` and the flight data is left untouched, and every case that uses this
 * asserts that the helper said "rewrote" and that the card is drawn (`openFormWithChoice`). A change of Next's payload turns the cases red, never silently green. Both halves are unit-tested (`tests/unit/flight-form.test.ts`).
 *
 * Limits, so a later case does not lean on them (QLT-836-08): the hook holds every flight chunk until `DOMContentLoaded`, so hydration cannot start early under it; it does not escape a card string that starts with `import type { Page } from '@playwright/test';

/**
 * Adds a card to the part form's definition as the Engineer's page carries it, for the E2E cases whose subject is a form the real registry does not have (DEF-085, DL-469, DL-470 (2) (iii)).
 *
 * Why it exists: the Engineer's page hands its form the definition as a prop (`seed.form`, the body `GET /estimates/{id}/form` answers), so it no longer reads `/form` from the browser, and a case can no longer
 * change what the form shows by answering that route itself. The registry is shared by all three projects and its versions are global, so a case cannot add a field for real either. What is left is the prop as it
 * travels: the server component's props are serialised into the page's `self.__next_f.push([1, "..."])` scripts (the flight data), where the seed is plain inline JSON.
 *
 * How: not by answering the document (a document that the test fulfils is treated by the browser as coming from another address space, and its own requests to the server are then blocked, so the page never starts),
 * but by an init script that sits where Next's client reads the flight data: it holds the chunks until the document is loaded, joins the text, rewrites the one form body, and hands Next the whole as the first chunk,
 * in order. The finding is **by the body's own shape** (`sections` and `lastSavedAt`), never by a chunk id, a module path or a row number, so a change of the bundler's references does not matter.
 *
 * Loud on purpose: `rewriteFlightText` throws unless it found and rewrote exactly one body; in the page the error is left in `self.__flightFormRewrite` and the flight data is left untouched, and every case that uses this
 * asserts that the helper said "rewrote" and that the card is drawn (`openFormWithChoice`). (flight reads it as a reference); and it acts on a hard load of the page only, not on a soft navigation's own RSC fetch.
 */

/** What is read and written of the form body: the sections and the time of the last write. */
export interface FormBody {
  sections: Array<Record<string, unknown>>;
  lastSavedAt: string | null;
}

/**
 * Applies `mutate` to the one object of the form body's shape in the joined flight text and returns the text with it written back. **Self-contained on purpose** (it is also sent to the page as source, so it uses
 * nothing from this module). Throws unless exactly one body was found and the change changed something.
 */
export function rewriteFlightText(text: string, mutate: (form: FormBody) => FormBody): string {
  const start = '{"sections":[';
  const endOfJson = (from: number): number => {
    let depth = 0;
    let inString = false;
    for (let index = from; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (char === '\\') index += 1;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '{' || char === '[') depth += 1;
      else if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) return index + 1;
      }
    }
    throw new Error('flight-form: a JSON value in the flight data never closed');
  };
  const found: Array<{ from: number; to: number; body: FormBody }> = [];
  for (let from = text.indexOf(start); from !== -1; from = text.indexOf(start, from + 1)) {
    const to = endOfJson(from);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.slice(from, to));
    } catch {
      continue;
    }
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as FormBody).sections) && Object.hasOwn(parsed, 'lastSavedAt')) found.push({ from, to, body: parsed as FormBody });
  }
  if (found.length !== 1) {
    throw new Error(`flight-form: expected exactly one form body in the flight data, found ${String(found.length)}; Next's payload may have changed (a body referenced instead of inlined, or sent twice)`);
  }
  const only = found[0];
  if (only === undefined) throw new Error('flight-form: no body');
  const rewritten = text.slice(0, only.from) + JSON.stringify(mutate(structuredClone(only.body))) + text.slice(only.to);
  if (rewritten === text) throw new Error('flight-form: the change changed nothing; a case that uses it must add something');
  return rewritten;
}

/**
 * The hook, as it runs in the page before any script of it (`addInitScript`). **Self-contained on purpose** (sent as source). It stands where Next's client reads the flight data: `self.__next_f` is an array
 * whose `push` collects the page's chunks and, when Next's own code replaces `push`, hands Next what was collected. The chunks are held until the document is loaded; then the text chunks are joined, rewritten
 * and handed over as one, in the order of the other chunks. Anything it cannot do is left in `self.__flightFormRewrite` ("rewrote" when it worked, the error otherwise) and the data is handed over as it came.
 */
export function installFlightFormHook(card: Record<string, unknown>, rewrite: (text: string, mutate: (form: FormBody) => FormBody) => string): void {
  const scope = self as unknown as { __next_f?: unknown[]; __flightFormRewrite?: string };
  const target: unknown[] = [];
  const held: unknown[][] = [];
  let released = false;
  let forward: ((item: unknown[]) => void) | null = null;
  const hand = (item: unknown[]): void => {
    if (forward !== null) forward(item);
    else Array.prototype.push.call(target, item);
  };
  const release = (): void => {
    if (released) return;
    released = true;
    const texts = held.filter((item) => item[0] === 1 && typeof item[1] === 'string');
    let handed = [...held];
    if (texts.length > 0) {
      try {
        // The stream is ordered: text chunks are joined into the first one only when no other kind of chunk (a binary row) sits between them, or the later text would move ahead of it.
        const firstAt = held.indexOf(texts[0] as unknown[]);
        const lastAt = held.indexOf(texts[texts.length - 1] as unknown[]);
        if (held.slice(firstAt, lastAt + 1).some((item) => !texts.includes(item))) throw new Error('flight-form: a chunk that is not text sits between text chunks; joining them would reorder the stream');
        const joined = texts.map((item) => item[1] as string).join('');
        const text = rewrite(joined, (form) => ({ ...form, sections: [...form.sections, card] }));
        const first = texts[0];
        handed = held.flatMap((item) => (item === first ? [[1, text]] : texts.includes(item) ? [] : [item]));
        scope.__flightFormRewrite = 'rewrote';
      } catch (error) {
        scope.__flightFormRewrite = String(error);
      }
    }
    held.length = 0;
    handed.forEach(hand);
  };
  const ours = (...items: unknown[][]): number => {
    for (const item of items) {
      if (released) hand(item);
      else held.push(item);
    }
    return 0;
  };
  Object.defineProperty(target, 'push', {
    configurable: true,
    get: () => ours,
    set: (replacement: (item: unknown[]) => void) => {
      forward = replacement;
    },
  });
  Object.defineProperty(self, '__next_f', { configurable: true, get: () => target, set: () => undefined });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', release);
  else release();
}

/** The source of the hook with the card and the rewriting function written in, for `addInitScript` and for the unit test. */
export function hookSource(card: Record<string, unknown>): string {
  return `(${installFlightFormHook.toString()})(${JSON.stringify(card)}, ${rewriteFlightText.toString()});`;
}

/** Adds `card` as a section of the form body the page carries, on every load of this page object. Call it before the page is opened. */
export async function addCardToTheFormBody(page: Page, card: Record<string, unknown>): Promise<void> {
  await page.addInitScript(hookSource(card));
}
