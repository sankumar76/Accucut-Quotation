import { expect, test, type Page, type Request as PageRequest, type TestInfo } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { columnLetterToIndex } from '../../src/lib/columns';

import { ensureCanaryCustomers, ensureCanaryMaterials, setCanaryCustomer, useFreshAddress } from './support/auth';
import { horizontalOverflow } from './support/design-system';
import { control, expectFormAccessible, isPatchOfInputs, leastFieldHeight, nextSave, openForm, partForm, signInAsNewEngineer } from './support/part-form';

/**
 * STORY-05.05 T6 (AC-1, AC-2, AC-3, AC-6; FR-048; SPEC section 14.4) at 360x800, 768x1024 and 1366x768 on the development server: Fasteners Qty (T) and Cost (U) show only when the part has
 * fasteners. They are not drawn (not just disabled) while Fasteners (S) is "None" in any letter case, with spaces around it, or blank, and then they are not counted in "n of m"; any other word shows them
 * again with the values typed earlier; the server holds 0.00 for them while they are hidden; showing and hiding them moves no focus; axe finds nothing. The rule itself and the stored values are judged
 * in `tests/unit/estimate/fasteners-save.test.ts` and `tests/integration/estimates/fasteners.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const FASTENERS_REGION = '05 Fasteners';
const NONE = 'None';
const NONE_SPELLINGS = ['none', ' NONE ', 'NoNe'] as const;
const WITH_FASTENERS = 'M6 bolt';
const OTHER_FASTENERS = 'Rivets';
const TYPED_QTY = '5';
const TYPED_COST = '3.5';
const SHOWN_QTY = '5.00';
const SHOWN_COST = '3.50';
const HIDDEN_NUMBER = '0.00';
const COUNT_WITHOUT_QTY_AND_COST = '1 of 1 complete';
const COUNT_WITH_QTY_AND_COST_EMPTY = '1 of 3 complete';
const COUNT_WITH_QTY_AND_COST_FILLED = '3 of 3 complete';

const region = (page: Page) => page.getByRole('region', { name: FASTENERS_REGION });
const fieldId = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));

/** What the server holds of the part, by field ID (the estimate and its one part have the person's ID). */
async function storedValues(page: Page, id: string): Promise<Record<string, string>> {
  const response = await page.request.get(`/api/v1/estimates/${id}/nodes/${id}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { readonly inputs: ReadonlyArray<{ readonly fieldId: string; readonly value: string }> };
  return Object.fromEntries(body.inputs.map((entry) => [entry.fieldId, entry.value]));
}

/**
 * DEF-038 (AQP-341): every save the page sent for the part, with the time since the page was open, what it carried and the answer. The one failure seen (run 43998662056, first attempt) was the stored values
 * still old after the save of "None" was answered 200, and the trace of that attempt was not kept. Nothing here changes what the test does or asserts.
 */
function recordSaves(page: Page): string[] {
  const started = Date.now();
  const saves: string[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (isPatchOfInputs(request.url(), request.method())) saves.push(`+${String(Date.now() - started)} ms PATCH ${String(response.status())} ${request.postData() ?? ''}`);
  });
  return saves;
}

/**
 * The stored values are those expected. When they are not, the job log and an attachment get the saves the page sent and a second read of the server two seconds later, which tells a write that landed
 * late (or a save that was never sent) from one that was answered and never stored, and then the assertion fails as it always did.
 */
async function expectStored(page: Page, id: string, expected: Record<string, string>, saves: ReadonlyArray<string>, testInfo: TestInfo): Promise<void> {
  const first = await storedValues(page, id);
  if (Object.entries(expected).some(([fieldId, value]) => first[fieldId] !== value)) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const second = await storedValues(page, id);
    const report = [
      `[AQP-341 stored-values diagnostic] ${testInfo.project.name} | attempt ${String(testInfo.retry + 1)} | the first read did not hold what was saved`,
      `  first read: ${JSON.stringify(first)}`,
      `  second read, 2 s later: ${JSON.stringify(second)}`,
      ...saves.map((line) => `  save ${line}`),
    ].join('\n');
    process.stdout.write(`${report}\n`);
    await testInfo.attach('stored-values-diagnostic', { body: report, contentType: 'text/plain' });
  }
  expect(first).toMatchObject(expected);
}

/** Leaves Fasteners with the text and waits for the save that follows. */
async function saveFasteners(page: Page, text: string): Promise<void> {
  const saved = nextSave(page);
  await control(page, 'S').fill(text);
  await control(page, 'S').blur();
  expect(await saved).toBe(200);
}

test.describe('AC-1: hidden while Fasteners is "None" or blank', () => {
  test('AC-1: Qty and Cost are not on a new part (not disabled: not there), and the card counts Fasteners alone', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(control(page, 'S')).toHaveValue(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /Fasteners Qty/ })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /Fasteners Cost/ })).toHaveCount(0);
    await expect(region(page)).toContainText(COUNT_WITHOUT_QTY_AND_COST);
    await expect(region(page)).not.toContainText('Fasteners Qty');
  });

  test('AC-1: "none", " NONE " and a blank keep them hidden as they are typed, and a repeat of the default sends nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    for (const spelling of NONE_SPELLINGS) {
      await control(page, 'S').fill(spelling);
      await expect(control(page, 'T'), spelling).toHaveCount(0);
      await expect(control(page, 'U'), spelling).toHaveCount(0);
    }
    await control(page, 'S').fill('');
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    // Left blank, the box shows its default "None" again, and nothing was stored for it.
    await control(page, 'S').blur();
    await expect(control(page, 'S')).toHaveValue(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});

test.describe('AC-2, AC-3: any other word shows them, with what was typed earlier; the server holds 0 while they are hidden', () => {
  test('AC-2: another word shows Qty and Cost, empty and counted; typed values are saved as two decimals', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await saveFasteners(page, WITH_FASTENERS);
    await expect(control(page, 'T')).toBeVisible();
    await expect(control(page, 'U')).toBeVisible();
    await expect(control(page, 'T')).toHaveValue('');
    await expect(region(page)).toContainText(COUNT_WITH_QTY_AND_COST_EMPTY);
    const savedQty = nextSave(page);
    await control(page, 'T').fill(TYPED_QTY);
    await control(page, 'T').blur();
    expect(await savedQty).toBe(200);
    const savedCost = nextSave(page);
    await control(page, 'U').fill(TYPED_COST);
    await control(page, 'U').blur();
    expect(await savedCost).toBe(200);
    await expect(control(page, 'T')).toHaveValue(SHOWN_QTY);
    await expect(control(page, 'U')).toHaveValue(SHOWN_COST);
    await expect(region(page)).toContainText(COUNT_WITH_QTY_AND_COST_FILLED);
    expect(await storedValues(page, owner.id)).toMatchObject({ [fieldId('T')]: SHOWN_QTY, [fieldId('U')]: SHOWN_COST });
  });

  test('AC-2, AC-3: back to "None" hides them and the server holds 0.00; another word shows them again with what was typed, and saves it', async ({ page }, testInfo) => {
    // One of two tests that are slow by what they do (AQP-340): seven saves, four reads of the server and a reload, one after the other. Measured: 23.2 s on a mobile shard of a green run (44021154191) and
    // 22.9 s of actions in the trace of a tablet attempt that ran out of its 30 s on the slowest shard (runs 44025795508, 44045571667). Three times the default, for this test only.
    test.slow();
    const owner = await openForm(page, testInfo);
    const saves = recordSaves(page);
    await saveFasteners(page, WITH_FASTENERS);
    for (const [letter, typed] of [
      ['T', TYPED_QTY],
      ['U', TYPED_COST],
    ] as const) {
      const saved = nextSave(page);
      await control(page, letter).fill(typed);
      await control(page, letter).blur();
      expect(await saved).toBe(200);
    }

    await saveFasteners(page, NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    await expect(region(page)).toContainText(COUNT_WITHOUT_QTY_AND_COST);
    // The rule is the server's: what it holds for them is 0.00, whatever was typed before (SPEC section 14.4).
    await expectStored(page, owner.id, { [fieldId('S')]: NONE, [fieldId('T')]: HIDDEN_NUMBER, [fieldId('U')]: HIDDEN_NUMBER }, saves, testInfo);

    // The values typed earlier come back with the fields, and the server is given them again, so the screen and the part agree.
    await saveFasteners(page, OTHER_FASTENERS);
    await expect(control(page, 'T')).toHaveValue(SHOWN_QTY);
    await expect(control(page, 'U')).toHaveValue(SHOWN_COST);
    await expect.poll(async () => (await storedValues(page, owner.id))[fieldId('T')]).toBe(SHOWN_QTY);
    await expect.poll(async () => (await storedValues(page, owner.id))[fieldId('U')]).toBe(SHOWN_COST);

    // After a reload the page shows what the server holds.
    await page.reload();
    await expect(control(page, 'T')).toHaveValue(SHOWN_QTY);
    await expect(control(page, 'U')).toHaveValue(SHOWN_COST);
  });

  test('AC-3: after "None" and a reload, Qty and Cost are hidden, and showing them again offers what the server holds: 0.00', async ({ page }, testInfo) => {
    // One of three tests marked for AQP-340 part 2 (DL-232 M3): it ran to within 0.4 s of the 30 s default on a loaded runner. On the desktop shard it is one of the first eight tests after the set-up project, which
    // does not warm the estimate workspace, so it waits for the development server's first compile of that page. Measured (CI, Stage 12): desktop 29.6 s (run 44053813502 attempt 1), 17.5 s (attempt 2) and
    // 28.9 s (run 44078137874); mobile 13.1 to 16.8 s and tablet 14.7 to 19.5 s in the same runs. Three times the default, for this test only.
    test.slow();
    const owner = await openForm(page, testInfo);
    await saveFasteners(page, WITH_FASTENERS);
    const savedQty = nextSave(page);
    await control(page, 'T').fill(TYPED_QTY);
    await control(page, 'T').blur();
    expect(await savedQty).toBe(200);
    await saveFasteners(page, NONE);
    await page.reload();
    await expect(control(page, 'S')).toHaveValue(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await control(page, 'S').fill(OTHER_FASTENERS);
    await expect(control(page, 'T')).toHaveValue(HIDDEN_NUMBER);
    expect((await storedValues(page, owner.id))[fieldId('T')]).toBe(HIDDEN_NUMBER);
  });
});

test.describe('AC-6: the screen at 360, 768 and 1366 px', () => {
  test('AC-6: showing and hiding Qty and Cost moves no focus, Enter goes S, T, U, V, and with "None" S goes to V', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await control(page, 'S').focus();
    await control(page, 'S').fill(WITH_FASTENERS);
    await expect(control(page, 'T')).toBeVisible();
    await expect(control(page, 'S')).toBeFocused();
    await control(page, 'S').fill(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'S')).toBeFocused();

    await control(page, 'S').fill(WITH_FASTENERS);
    const saved = nextSave(page);
    await page.keyboard.press('Enter');
    expect(await saved).toBe(200);
    await expect(control(page, 'T')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(control(page, 'U')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(control(page, 'V')).toBeFocused();

    await control(page, 'S').fill(NONE);
    const savedNone = nextSave(page);
    await page.keyboard.press('Enter');
    expect(await savedNone).toBe(200);
    await expect(control(page, 'V')).toBeFocused();
  });

  test('AC-6: with Qty and Cost shown there is no sideways scroll, axe finds nothing, and each is 44 px high', async ({ page }, testInfo) => {
    // One of three tests marked for AQP-340 part 2 (DL-232 M3): three axe scans, two saves and the form's first load, and it ran out of its 30 s once (`page.evaluate` inside `AxeBuilder.analyze`, run
    // 44078137874, desktop shard). Each scan is kept whole: no rule is dropped and no region is left out. Measured (CI, Stage 12): desktop 29.7 s (run 44053813502 attempt 1), 17.8 s (attempt 2), 24.6 s and
    // 30.2 s (failed) in run 44078137874; mobile 13.9 to 21.1 s and tablet 19.5 to 23.1 s in the same runs. Three times the default, for this test only.
    test.slow();
    await openForm(page, testInfo);
    await expectFormAccessible(page);
    await saveFasteners(page, WITH_FASTENERS);
    await expect(partForm(page)).toBeVisible();
    await expect(control(page, 'T')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const letter of ['T', 'U']) expect((await control(page, letter).boundingBox())?.height ?? 0, letter).toBeGreaterThanOrEqual(await leastFieldHeight(page));
    await expectFormAccessible(page);
    await saveFasteners(page, NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });
});

/**
 * DEF-063 (AQP-397), MEASUREMENT ONLY. The first cases of this file failed attempt 1 on the 15 s `expect` in `waitForForm` (`form[data-part-form]` "element(s) not found") as tests 4 to 7 of shard 4, and the trace
 * of attempt 1 is not kept. This prints ONE LINE per attempt for every case of the file (the job log carries it) that says what the page was doing instead: when the estimate page's document was requested and
 * answered, when the form's loading skeleton was first on the page (3 blocks: the form's definition or its code is on the way, `part-form.tsx`; 4 blocks: the part's stored values are on the way, `part-fields.tsx`), when
 * the form first was, what is on the page at the end, which scripts and API reads were answered and how late, and what was still pending. It changes no wait, no assertion and no request of any case. Remove it
 * with the fix.
 */
const PROBE_TAG = '[AQP-397 first-open]';
const PROBE_LOADING_LABEL = 'Loading the form';
const PROBE_FORM_SELECTOR = 'form[data-part-form]';
const PROBE_MAX_LISTED = 8;

interface ProbeRequest {
  readonly kind: 'document' | 'script' | 'api' | 'fetch';
  readonly method: string;
  readonly path: string;
  readonly requestedAt: number;
  answeredAt: number | null;
  finishedAt: number | null;
  status: number | null;
  failure: string | null;
}

interface Probe {
  readonly startedAt: number;
  readonly marks: Map<string, number>;
  readonly requests: Map<PageRequest, ProbeRequest>;
}

interface ProbeScreen {
  readonly readyState: string;
  readonly definitionSkeletons: number;
  readonly valuesSkeletons: number;
  readonly forms: number;
  readonly otherLoadingStatuses: number;
  readonly errorOverlay: boolean;
}

const probes = new WeakMap<Page, Probe>();
let probedInThisWorker = 0;

function probeKind(request: PageRequest): ProbeRequest['kind'] | null {
  const type = request.resourceType();
  const path = new URL(request.url()).pathname;
  if (type === 'document') return 'document';
  if (type === 'script') return 'script';
  if (path.startsWith('/api/')) return 'api';
  if (type === 'fetch' || type === 'xhr') return 'fetch';
  return null;
}

/** Ids are cut out so one line reads the same in every run, and a long script path keeps its tail. */
function probePath(kind: ProbeRequest['kind'], url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ':id');
  const shown = kind === 'script' && path.length > 48 ? `...${path.slice(-48)}` : path;
  return kind === 'fetch' ? `${shown}${parsed.search.length > 0 ? '?' : ''}` : shown;
}

async function startProbe(page: Page): Promise<void> {
  const probe: Probe = { startedAt: Date.now(), marks: new Map(), requests: new Map() };
  probes.set(page, probe);
  // The page tells the first time of each thing it shows; a later document (a reload) does not overwrite the first load.
  await page.exposeFunction('aqp397Mark', (name: string, at: number) => {
    if (!probe.marks.has(name)) probe.marks.set(name, at);
  });
  await page.addInitScript(
    ({ label, formSelector }) => {
      const sent = new Set<string>();
      const mark = (name: string): void => {
        if (sent.has(name)) return;
        sent.add(name);
        const report: unknown = Reflect.get(window, 'aqp397Mark');
        if (typeof report === 'function') Reflect.apply(report, window, [name, Date.now()]);
      };
      const scan = (): void => {
        for (const status of document.querySelectorAll(`[role="status"][aria-label="${label}"]`)) mark(status.children.length === 3 ? 'definition-skeleton' : 'values-skeleton');
        if (document.querySelector(formSelector) !== null) mark('form');
        if (document.querySelector('nextjs-portal') !== null) mark('error-overlay');
      };
      new MutationObserver(scan).observe(document, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', () => {
        mark('dom-content-loaded');
        scan();
      });
      window.addEventListener('load', () => mark('load'));
    },
    { label: PROBE_LOADING_LABEL, formSelector: PROBE_FORM_SELECTOR },
  );
  page.on('request', (request) => {
    const kind = probeKind(request);
    if (kind === null) return;
    probe.requests.set(request, { kind, method: request.method(), path: probePath(kind, request.url()), requestedAt: Date.now(), answeredAt: null, finishedAt: null, status: null, failure: null });
  });
  page.on('response', (response) => {
    const line = probe.requests.get(response.request());
    if (line !== undefined) {
      line.answeredAt = Date.now();
      line.status = response.status();
    }
  });
  page.on('requestfinished', (request) => {
    const line = probe.requests.get(request);
    if (line !== undefined) line.finishedAt = Date.now();
  });
  page.on('requestfailed', (request) => {
    const line = probe.requests.get(request);
    if (line !== undefined) {
      line.finishedAt = Date.now();
      line.failure = request.failure()?.errorText ?? 'failed';
    }
  });
}

async function readScreen(page: Page): Promise<ProbeScreen | null> {
  const read = page
    .evaluate(
      ({ label, formSelector }): ProbeScreen => {
        const loading = [...document.querySelectorAll(`[role="status"][aria-label="${label}"]`)];
        return {
          readyState: document.readyState,
          definitionSkeletons: loading.filter((status) => status.children.length === 3).length,
          valuesSkeletons: loading.filter((status) => status.children.length === 4).length,
          forms: document.querySelectorAll(formSelector).length,
          otherLoadingStatuses: document.querySelectorAll('[role="status"][aria-label^="Loading"]').length - loading.length,
          errorOverlay: document.querySelector('nextjs-portal') !== null,
        };
      },
      { label: PROBE_LOADING_LABEL, formSelector: PROBE_FORM_SELECTOR },
    )
    .catch(() => null);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), 3_000);
  });
  const screen = await Promise.race([read, timeout]);
  clearTimeout(timer);
  return screen;
}

function probeLine(probe: Probe, screen: ProbeScreen | null, testInfo: TestInfo): string {
  const at = (time: number | null): string => (time === null ? '-' : `+${String(time - probe.startedAt)}`);
  const lines = [...probe.requests.values()];
  const documents = lines.filter((line) => line.kind === 'document');
  const first = documents[0];
  const scripts = lines.filter((line) => line.kind === 'script');
  const pendingScripts = scripts.filter((line) => line.finishedAt === null);
  const took = (line: ProbeRequest): number => (line.finishedAt ?? line.requestedAt) - line.requestedAt;
  const slowestScript = scripts.filter((line) => line.finishedAt !== null).sort((a, b) => took(b) - took(a))[0];
  const reads = lines.filter((line) => line.kind === 'api' || line.kind === 'fetch');
  const now = Date.now();
  const readText = (line: ProbeRequest): string =>
    `${line.method} ${line.path} req ${at(line.requestedAt)} ans ${at(line.answeredAt)} done ${at(line.finishedAt)} ${line.failure ?? String(line.status ?? '-')}`;
  const parts = [
    `${PROBE_TAG} ${testInfo.project.name} | :${String(testInfo.line)} | attempt ${String(testInfo.retry + 1)} | ${testInfo.status ?? 'unknown'} | worker ${String(testInfo.workerIndex)} case ${String(probedInThisWorker)} of this worker | ended ${at(now)} ms`,
    first === undefined
      ? 'document: none'
      : `document ${first.path} req ${at(first.requestedAt)} ans ${at(first.answeredAt)} done ${at(first.finishedAt)} ${String(first.status ?? '-')}${documents.length > 1 ? ` (+${String(documents.length - 1)} more)` : ''}`,
    `skeleton(definition/code) first ${at(probe.marks.get('definition-skeleton') ?? null)}`,
    `skeleton(values) first ${at(probe.marks.get('values-skeleton') ?? null)}`,
    `form first ${at(probe.marks.get('form') ?? null)}`,
    `dom-content-loaded ${at(probe.marks.get('dom-content-loaded') ?? null)} load ${at(probe.marks.get('load') ?? null)} overlay ${at(probe.marks.get('error-overlay') ?? null)}`,
    screen === null
      ? 'at end: page not readable'
      : `at end: ${screen.readyState} definition-skeletons ${String(screen.definitionSkeletons)} values-skeletons ${String(screen.valuesSkeletons)} forms ${String(screen.forms)} other-loading ${String(screen.otherLoadingStatuses)} overlay ${String(screen.errorOverlay)}`,
    `scripts ${String(scripts.length)} pending ${String(pendingScripts.length)}${slowestScript === undefined ? '' : ` slowest ${slowestScript.path} ${String(took(slowestScript))} ms`}`,
    `reads: ${reads.slice(0, PROBE_MAX_LISTED).map(readText).join('; ') || 'none'}${reads.length > PROBE_MAX_LISTED ? ` (+${String(reads.length - PROBE_MAX_LISTED)} more)` : ''}`,
    `pending: ${
      lines
        .filter((line) => line.finishedAt === null)
        .slice(0, PROBE_MAX_LISTED)
        .map((line) => `${line.kind} ${line.path} for ${String(now - line.requestedAt)} ms`)
        .join('; ') || 'none'
    }`,
  ];
  return parts.join(' | ');
}

test.beforeEach(async ({ page }) => {
  probedInThisWorker += 1;
  await startProbe(page);
});

test.afterEach(async ({ page }, testInfo) => {
  const probe = probes.get(page);
  if (probe === undefined) return;
  process.stdout.write(`${probeLine(probe, await readScreen(page), testInfo)}\n`);
});

/**
 * DEF-063 (AQP-397): the first open of the estimate workspace on a development server is not a case's subject, and it is the one that failed. The `[AQP-397 first-open]` lines of CI run 45019003031 (shard 4, desktop,
 * attempt 1 of every case) show that the three cases that start first, one on each of three workers at once, wait for routes the development server compiles on their first request, one after the other: the page's
 * document 2.3 to 2.6 s (0.4 to 0.9 s for the cases after them), the form's definition 2.6 to 2.7 s (0.4 to 0.7 s), the tree 3.0 to 3.1 s (0.4 to 0.6 s) and the part's stored values 1.7 s (0.2 to 0.5 s). The form is on the page 9.2 to 9.6 s
 * in, against 3.4 to 5.3 s for the cases after them, and a slower draw of the same chain is the 15 s `expect` of `waitForForm` that ran out at about 20 s. The part form's skeleton stood the whole time (it is the page's waiting state, in place
 * while those reads are answered, and not the cause), no script was pending and no error overlay showed. A production build compiles ahead of time, so this is the development server's cost and not product behaviour
 * (DL-272 (B)). Each worker therefore opens the workspace once before its first case, as a person of its own, so the routes are compiled when the cases start. It waits for the form with no limit of its own (the hook's time is the only
 * one), and a failure here is a failure of the hook, which every case of the worker shows. It sends no request to `/recalculate` and changes no case.
 */
test.beforeAll(async ({ browser }, testInfo) => {
  const started = Date.now();
  const context = await browser.newContext({ baseURL: defined(testInfo.project.use.baseURL) });
  try {
    await useFreshAddress(context);
    const page = await context.newPage();
    await ensureCanaryCustomers();
    await ensureCanaryMaterials();
    const owner = await signInAsNewEngineer(page, testInfo);
    await setCanaryCustomer(owner.id, defined(CUSTOMER_CANARIES[0]).id);
    await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
    await partForm(page).waitFor();
    process.stdout.write(`[AQP-397 warm-up] ${testInfo.project.name} | worker ${String(testInfo.workerIndex)} | the form was on the page ${String(Date.now() - started)} ms after the hook began\n`);
  } finally {
    await context.close();
  }
});
