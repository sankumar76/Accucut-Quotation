import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';

import { defined } from '../support/defined';

import { useFreshAddress } from './support/auth';
import { horizontalOverflow } from './support/design-system';
import { ALPHA_MATERIAL, control, expectFormAccessible, isPatchOfInputs, isPhone, leastFieldHeight, NUMBER_RULE, nextSave, openForm, partForm, showTree, tree, waitForForm } from './support/part-form';

/**
 * STORY-05.03 T8 (AC-1 to AC-6, AC-8, AC-9; review SQR-11): the part form of SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test
 * signs in as a person of its own, who owns a task with an empty draft estimate and one part (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`),
 * chooses the customer so the form opens, and types into the part with the keyboard. The words are the UX spec's and the story's, written out here and not imported, so a changed
 * sentence fails a test; the field IDs are the seed registry's, which the server's form is built from. What the database holds (the revisions, the transaction, the lock) is judged in
 * `tests/integration/estimates/form.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const QTY_HINT = 'Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.';
/** The words with "cost" in them that the form may say: the four typed inputs (FR-008) and the name of section 08 (SPEC 7.1). */
const ALLOWED_COST_WORDS = ['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost', 'Other Costs and Remarks'];

/**
 * DEF-074 (AQP-417, DL-344, DL-345): the delete in SQR-01 (b) failed attempt 1 twice on Next 16.4.6 at "Row deleted" with no received text. The wait cannot say whether the delete had no answer in 15 s, was refused
 * (for example a 409 `TREE_CHANGED`), or answered ok and the announcement was not drawn. `watchDelete` is started before the first save and records the requests and, in the page, how the screen changed (the
 * in-flight line of `change()`, the tree controls' `aria-disabled`, the notices); when the wait fails, `expectRowDeleted` prints `[AQP-417 delete diagnostic]` (to stdout, so it is in the job log, and as an
 * attachment) and re-throws the wait's own error. Nothing is printed when the wait passes, and no assertion, limit or retry is changed.
 * How to read it: a DELETE with status 409, 4xx or 5xx, or a `TREE_CHANGED` answer, is a refusal; `no answer` is the server or the browser not answering, and the in-flight line and the time-limit notices
 * say whether the page's own limit (#652) had run; a `200` with the tree as rendered already without the part is an announcement that was cleared or never drawn.
 */
const NODE_ROUTE = /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+$/;
const TREE_ROUTE = /\/api\/v1\/estimates\/[^/]+\/tree$/;
/** What the report waits for the page: it must never hold up the test's own failure for long. */
const REPORT_PATIENCE_MS = 5_000;
const BODY_PATIENCE_MS = 300;
const KEPT_BODY = 300;
/** The words of the tree's in-flight line and of its notices (`estimate-texts.ts`), written out here and not imported: a changed sentence shows as "not seen", never as a failure of this report. */
const IN_FLIGHT_WORDS = 'Updating the parts. This takes a moment.';
const NOTICE_WORDS = ['The change was not made', 'We could not load the parts', 'The parts were changed by someone else', 'Row deleted'] as const;

interface WatchedCall {
  readonly label: string;
  readonly path: string;
  readonly sent: string;
  readonly sentAt: number;
  headersAt?: number;
  finishedAt?: number;
  status?: number;
  failure?: string;
  answer?: string;
}

interface DeleteWatch {
  readonly startedAt: number;
  readonly calls: WatchedCall[];
}

/**
 * Records in the page, each time the screen changes, whether the in-flight line is shown, how many tree controls are `aria-disabled` and which notices are shown. A line is kept only when the state differs
 * from the one before. It never throws into the page.
 */
async function recordScreenChanges(page: Page, inFlight: string, notices: readonly string[]): Promise<void> {
  try {
    await page.evaluate(
      ({ line, words }) => {
        const holder = window as unknown as { __aqp417?: string[] };
        if (holder.__aqp417 !== undefined) return;
        const log: string[] = [];
        holder.__aqp417 = log;
        const started = Date.now();
        const controls = (): HTMLElement[] =>
          [...document.querySelectorAll<HTMLElement>('button')].filter((button) => /^(Move up|Move down|Add main assembly|Delete \d|Add )/.test((button.getAttribute('aria-label') ?? button.textContent ?? '').trim()));
        let last = '';
        const snapshot = (): void => {
          try {
            const text = document.body.textContent ?? '';
            const disabled = controls().filter((control) => control.getAttribute('aria-disabled') === 'true').length;
            const shown = words.filter((word) => text.includes(word));
            const state = `in-flight line ${text.includes(line) ? 'SHOWN' : 'not shown'}; tree controls aria-disabled ${String(disabled)} of ${String(controls().length)}; notices shown: ${shown.join(' | ') || 'none'}`;
            if (state === last) return;
            last = state;
            if (log.length < 60) log.push(`+${String(Date.now() - started)} ms: ${state}`);
          } catch {
            // The report must not disturb the page.
          }
        };
        let pending = false;
        new MutationObserver(() => {
          if (pending) return;
          pending = true;
          setTimeout(() => {
            pending = false;
            snapshot();
          }, 0);
        }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-disabled'] });
        snapshot();
      },
      { line: inFlight, words: [...notices] },
    );
  } catch {
    // Without it the report says that the page's history was not recorded.
  }
}

/** Starts recording the saves (PATCH of inputs), the delete (DELETE of the part) and the tree reads after the delete was sent. Call it before the first save and before the click. */
async function watchDelete(page: Page): Promise<DeleteWatch> {
  const watch: DeleteWatch = { startedAt: Date.now(), calls: [] };
  const callOf = new Map<Request, WatchedCall>();
  const labelOf = (request: Request): string | null => {
    const { pathname } = new URL(request.url());
    if (isPatchOfInputs(request.url(), request.method())) return 'save (PATCH inputs)';
    if (request.method() === 'DELETE' && NODE_ROUTE.test(pathname)) return 'DELETE node';
    if (request.method() === 'GET' && TREE_ROUTE.test(pathname) && watch.calls.some((call) => call.label === 'DELETE node')) return 'tree read after the delete (GET tree)';
    return null;
  };
  page.on('request', (request) => {
    const label = labelOf(request);
    if (label === null) return;
    const { pathname, search } = new URL(request.url());
    const sent = request.method() === 'PATCH' ? (request.postData() ?? '') : search;
    const call: WatchedCall = { label, path: pathname.split('/').slice(-1)[0] ?? '', sent: sent.slice(0, KEPT_BODY), sentAt: Date.now() };
    callOf.set(request, call);
    watch.calls.push(call);
  });
  page.on('response', (response) => {
    const call = callOf.get(response.request());
    if (call === undefined) return;
    call.headersAt = Date.now();
    call.status = response.status();
    // The answer's own words (a refusal's code, a save's new revision); a body that cannot be read is no reason to stop.
    void response
      .text()
      .then((body) => {
        call.answer = body.slice(0, KEPT_BODY);
      })
      .catch(() => {
        call.answer = '(body not readable)';
      });
  });
  page.on('requestfinished', (request) => {
    const call = callOf.get(request);
    if (call !== undefined) call.finishedAt = Date.now();
  });
  page.on('requestfailed', (request) => {
    const call = callOf.get(request);
    if (call === undefined) return;
    call.failure = request.failure()?.errorText ?? 'failed (no text)';
    call.finishedAt = Date.now();
  });
  await recordScreenChanges(page, IN_FLIGHT_WORDS, NOTICE_WORDS);
  return watch;
}

function describeDeleteCalls(watch: DeleteWatch, now: number): string[] {
  if (watch.calls.length === 0) return ['  requests (0): none seen'];
  const lines = watch.calls.map((call, index) => {
    const at = `+${String(call.sentAt - watch.startedAt)} ms`;
    let outcome: string;
    if (call.failure !== undefined) outcome = `failed "${call.failure}" after ${String((call.finishedAt ?? now) - call.sentAt)} ms`;
    else if (call.status === undefined) outcome = `no answer after ${String(now - call.sentAt)} ms`;
    else {
      const body = call.finishedAt === undefined ? `body not finished after ${String(now - call.sentAt)} ms` : `body finished after ${String(call.finishedAt - call.sentAt)} ms`;
      outcome = `status ${String(call.status)} after ${String((call.headersAt ?? now) - call.sentAt)} ms, ${body}`;
    }
    return `  request #${String(index + 1)} ${call.label} .../${call.path} sent ${at}: ${outcome}; sent ${call.sent || '(nothing)'}; answer ${call.answer ?? '(none read)'}`;
  });
  return [`  requests (${String(watch.calls.length)}):`, ...lines];
}

/** The screen as it is, read in one go in the page: the dialog, the words of the wait, the in-flight line, the tree controls, the tree in order, every live region and notice, and what the page recorded on the way. */
async function readDeleteScreen(page: Page): Promise<string[]> {
  const screen = await page.evaluate(
    ({ inFlight, notices }) => {
      const textOf = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const rows = [...document.querySelectorAll('nav[aria-label="Parts tree"] a[data-part-id]')].map((row) => `${textOf(row.querySelector('[data-sl-no]'))} (${row.getAttribute('aria-current') === 'true' ? 'open' : 'closed'})`);
      const liveRegions = [...document.querySelectorAll('[role="status"], [aria-live]')].map((region) => `${region.classList.contains('sr-only') ? 'sr-only ' : ''}${region.getAttribute('role') ?? 'aria-live'} "${textOf(region)}"`);
      const alerts = [...document.querySelectorAll('[role="alert"]')].map((alert) => textOf(alert)).filter((text) => text !== '');
      // The elements `getByText` would count: the innermost ones that hold the words (it ignores case).
      const holds = (element: Element, words: string): boolean => textOf(element).toLowerCase().includes(words.toLowerCase());
      const count = (words: string): number => [...document.querySelectorAll('body *:not(script):not(style)')].filter((element) => holds(element, words) && ![...element.children].some((child) => holds(child, words))).length;
      const controls = [...document.querySelectorAll<HTMLElement>('button')]
        .map((button) => ({ name: (button.getAttribute('aria-label') ?? button.textContent ?? '').trim().slice(0, 40), disabled: button.getAttribute('aria-disabled') === 'true' }))
        .filter((control) => /^(Move up|Move down|Add main assembly|Delete \d|Add )/.test(control.name));
      const history = (window as unknown as { __aqp417?: string[] }).__aqp417;
      return {
        rows,
        liveRegions,
        alerts,
        deleted: count('Row deleted'),
        dialogs: document.querySelectorAll('[role="alertdialog"]').length,
        inFlight: count(inFlight),
        noticeCounts: notices.map((words) => `"${words}" x${String(count(words))}`),
        controls: controls.map((control) => `${control.name}: aria-disabled=${control.disabled ? 'true' : 'no'}`),
        history: history ?? null,
      };
    },
    { inFlight: IN_FLIGHT_WORDS, notices: [...NOTICE_WORDS] },
  );
  return [
    `  elements with "Row deleted": ${String(screen.deleted)} (the wait needs exactly 1); open dialogs: ${String(screen.dialogs)}`,
    `  in-flight line "${IN_FLIGHT_WORDS}" on screen now: ${screen.inFlight === 0 ? 'no' : 'YES'}`,
    `  notices now: ${screen.noticeCounts.join(' ; ')}; role=alert: ${screen.alerts.length === 0 ? 'none visible' : screen.alerts.map((alert) => `"${alert}"`).join(' | ')}`,
    `  tree controls now (${String(screen.controls.length)}): ${screen.controls.join(' ; ') || 'none'}`,
    `  tree as rendered (${String(screen.rows.length)}): ${screen.rows.join(' | ') || 'none'}`,
    `  live regions and status lines: ${screen.liveRegions.join(' | ') || 'none'}`,
    ...(screen.history === null ? ['  screen history: not recorded'] : [`  screen history in the watch (${String(screen.history.length)} changes):`, ...screen.history.map((line) => `    ${line}`)]),
  ];
}

/** The answer of `work`, or `fallback` when it takes longer than `ms` (the page may be stuck; its late answer or error is dropped). */
async function within<T>(ms: number, work: Promise<T>, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Prints and attaches the state. It never throws: a failed report must not replace the failure of the test. */
async function reportDeleteState(page: Page, testInfo: TestInfo, watch: DeleteWatch): Promise<void> {
  const now = Date.now();
  // A moment for the body of an answer that is still being read.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, BODY_PATIENCE_MS);
  });
  const header = `[AQP-417 delete diagnostic] ${testInfo.project.name} | ${testInfo.title} | attempt ${String(testInfo.retry + 1)} | toHaveCount(1) failed for "Row deleted" | watch ran ${String(now - watch.startedAt)} ms`;
  let screen: string[];
  try {
    if (page.isClosed()) screen = ['  screen: the page is closed'];
    else screen = await within(REPORT_PATIENCE_MS, readDeleteScreen(page), [`  screen: no answer from the page after ${String(REPORT_PATIENCE_MS)} ms`]);
  } catch (error) {
    screen = [`  screen: not readable (${error instanceof Error ? (error.message.split('\n')[0] ?? 'unknown') : 'unknown'})`];
  }
  const report = [header, ...describeDeleteCalls(watch, now), ...screen].join('\n');
  process.stdout.write(`${report}\n`);
  try {
    await testInfo.attach('delete-diagnostic', { body: report, contentType: 'text/plain' });
  } catch {
    // The report is in the log already.
  }
}

/** The wait the case always had ("Row deleted" once, within the 15 s of `expect`), with the diagnostic on its failure. The error that the wait throws is re-thrown as it is. */
async function expectRowDeleted(page: Page, testInfo: TestInfo, watch: DeleteWatch): Promise<void> {
  try {
    await expect(page.getByText('Row deleted')).toHaveCount(1);
  } catch (error) {
    await reportDeleteState(page, testInfo, watch);
    throw error;
  }
}

test.describe('AC-1, AC-2, AC-3, AC-8: what the form shows', () => {
  test('AC-1: sections 01 and 02 with their numbers, names and column ranges, and an Excel letter on every field that a screen reader reads first', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const first = page.getByRole('region', { name: '01 Part Details' });
    const second = page.getByRole('region', { name: '02 Material and Dimensions' });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    // The tag of 01 names Treatment / Color (G), a drop-down of the card since STORY-05.06.
    await expect(first).toContainText('A–D, G, H');
    await expect(second).toContainText('E, F, J–L, N');

    for (const [letter, name, role] of [
      ['A', 'Sl. No', 'textbox'],
      ['B', 'Part No.', 'textbox'],
      ['D', 'Description', 'textbox'],
      ['H', 'QTY per Assy', 'textbox'],
      ['G', 'Treatment / Color', 'combobox'],
      ['E', 'Material in Drawing', 'combobox'],
      ['F', 'Material Considered', 'textbox'],
      ['J', 'Length', 'textbox'],
      ['K', 'Width', 'textbox'],
      ['L', 'Thickness', 'textbox'],
      ['N', 'Part Weight', 'textbox'],
    ] as const) {
      // "Excel column J" comes first in the accessible name, then the label.
      await expect(page.getByRole(role, { name: new RegExp(`^Excel column ${letter}\\s+${name.replaceAll('.', '\\.')}`) })).toHaveCount(1);
      await expect(control(page, letter)).toBeVisible();
    }
    // Letters that are not typed into on the form are not controls: the picture, and Material Rate / Kg.
    for (const letter of ['C', 'I']) await expect(page.getByRole('textbox', { name: new RegExp(`^Excel column ${letter}\\s`) })).toHaveCount(0);
  });

  test('AC-2, AC-3, AC-8: the label stays "QTY per Assy" with the hint; Sl. No. and Material Considered are read-only; no rate, price, cost or formula is on the form', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(control(page, 'H')).toHaveAccessibleDescription(`${QTY_HINT} nos`);
    await expect(partForm(page).getByText(QTY_HINT)).toBeVisible();
    await expect(control(page, 'A')).toHaveAttribute('readonly', '');
    await expect(control(page, 'A')).toHaveValue('1');
    await expect(control(page, 'F')).toHaveAttribute('readonly', '');
    await expect(control(page, 'F')).toHaveValue('');
    // The word "cost" is in the labels of the four inputs an Engineer types and in the name of section 08, and nowhere else (STORY-05.04 AC-7).
    const text = await partForm(page).innerText();
    expect(ALLOWED_COST_WORDS.reduce((left, words) => left.replaceAll(words, ''), text)).not.toMatch(/rate|price|cost|formula/i);
    expect(await page.content()).not.toMatch(/Material Rate|Rate \/ Kg/);
  });

  test('AC-1: the cards sit one above the other on a phone and side by side from a tablet', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    // The compact layout (AQP-388) gives a card a share of its row by its number of fields: 01 and 02 (six each) fill a row of their own, so from a tablet the pair that shares a row is 03 and 04 (two each).
    const [firstName, secondName] = isPhone(page) ? ['01 Part Details', '02 Material and Dimensions'] : ['03 Cutting Process', '04 Bending'];
    // The picture field arrives after the form, in a file of its own (`PictureSlot`), and card 01 changes height when it does (AQP-395, DEF-061): wait for its box (`data-picture-zone`, the group named
    // "Part Model", `part-picture.tsx`) so the page is in its final state. Both cards are then read in one `evaluate`, one frame, and not by two `boundingBox()` calls that a move of the page can fall between.
    await expect(page.getByRole('region', { name: '01 Part Details' }).getByRole('group', { name: /Part Model/ })).toBeVisible();
    const secondCard = defined(await page.getByRole('region', { name: secondName }).elementHandle());
    const { first, second } = await page.getByRole('region', { name: firstName }).evaluate((left, right) => {
      const rect = (element: Element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      return { first: rect(left), second: rect(right) };
    }, secondCard);
    // What the layout is, so a failure says why: the width of the form and the columns the grid made.
    const layout = await partForm(page).evaluate((form) => ({
      formWidth: form.getBoundingClientRect().width,
      columns: getComputedStyle(form.querySelector('[data-part-grid]') ?? form).gridTemplateColumns,
      viewport: window.innerWidth,
    }));
    const why = `layout ${JSON.stringify(layout)}, first ${JSON.stringify(first)}, second ${JSON.stringify(second)}`;
    if (isPhone(page)) {
      expect(second.y, why).toBeGreaterThanOrEqual(first.y + first.height);
      expect(Math.abs(second.x - first.x), why).toBeLessThan(2);
    } else {
      expect(Math.abs(second.y - first.y), why).toBeLessThan(2);
      expect(second.x, why).toBeGreaterThan(first.x + first.width - 2);
    }
  });
});

test.describe('AC-4, AC-5, AC-7: typing, refusing and saving', () => {
  test('AC-4: -1, 1.234 and abc are refused under the field with the words of the rule and the typed text is kept; 12.5 is saved as 12.50 and survives a reload; a blank is saved too', async ({ page }, testInfo) => {
    // One of three tests marked for AQP-340 part 2 (DL-232 M3): the heaviest test of this file by what it does (three refused entries, two saves, two reloads of the form), and it ran out of its 30 s once
    // (`toBeVisible` on `form[data-part-form]` after the reload, run 44078137874, tablet shard). Measured (CI, Stage 12): tablet 21.7 s and 22.0 s (run 44053813502 attempts 1 and 2), 27.1 s and 30.1 s (failed)
    // in run 44078137874; desktop 13.9 to 28.8 s and mobile 17.9 to 20.1 s in the same runs. Three times the default, for this test only.
    test.slow();
    await openForm(page, testInfo);
    const length = control(page, 'J');
    for (const typed of ['-1', '1.234', 'abc']) {
      await length.fill(typed);
      await length.blur();
      await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();
      await expect(length).toHaveValue(typed);
      await expect(length).toHaveAttribute('aria-invalid', 'true');
    }

    const saved = nextSave(page, 'J');
    await length.fill('12.5');
    await length.blur();
    expect(await saved).toBe(200);
    await expect(length).toHaveValue('12.50');
    await expect(partForm(page).getByText(NUMBER_RULE)).toHaveCount(0);
    await expect(length).not.toHaveAttribute('aria-invalid', 'true');
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('12.50');

    const cleared = nextSave(page, 'J');
    await control(page, 'J').fill('');
    await control(page, 'J').blur();
    expect(await cleared).toBe(200);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('');
  });

  test('AC-4, AC-7: text is saved by leaving the field and a value equal after normalisation sends nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saved = nextSave(page, 'B');
    await control(page, 'B').fill('  FR-1  ');
    await control(page, 'B').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'B')).toHaveValue('FR-1');

    const savedWidth = nextSave(page, 'K');
    await control(page, 'K').fill('1.5');
    await control(page, 'K').blur();
    expect(await savedWidth).toBe(200);
    await expect(control(page, 'K')).toHaveValue('1.50');
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    // The same number again, spelled another way, is no change: nothing is sent.
    await control(page, 'K').fill('1.50');
    await control(page, 'K').blur();
    await control(page, 'K').fill('01.5');
    await control(page, 'K').blur();
    await expect(control(page, 'K')).toHaveValue('1.50');
    expect(requests).toEqual([]);
  });

  test('AC-5, AC-3: the material list has the canary material by name; choosing it fills Material Considered, saves, and survives a reload; no price is on the page', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const select = control(page, 'E');
    await expect(select.locator('option', { hasText: ALPHA_MATERIAL.materialInDrawing })).toHaveCount(1);
    const saved = nextSave(page, 'E');
    await select.selectOption({ label: ALPHA_MATERIAL.materialInDrawing });
    expect(await saved).toBe(200);
    await expect(control(page, 'F')).toHaveValue(ALPHA_MATERIAL.materialConsidered);

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'E').locator('option:checked')).toHaveText(ALPHA_MATERIAL.materialInDrawing);
    await expect(control(page, 'F')).toHaveValue(ALPHA_MATERIAL.materialConsidered);
    const content = await page.content();
    for (const number of [ALPHA_MATERIAL.pricePerKg, ALPHA_MATERIAL.specificGravity, ALPHA_MATERIAL.scrapRate]) expect(content).not.toContain(number);
  });

  test('SQR-01 (b): typing into a part moves the part\'s revision, and the tree follows: the part can still be deleted at once, with no "changed by someone else" notice', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const watch = await watchDelete(page);
    const saved = nextSave(page, 'L');
    await control(page, 'L').fill('3');
    await control(page, 'L').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'L')).toHaveValue('3.00');

    await showTree(page);
    await tree(page).getByRole('button', { name: /^Delete 1 / }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete row 1?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete row' }).click();
    await expect(dialog).toHaveCount(0);
    await expectRowDeleted(page, testInfo, watch);
    await expect(page.getByText('The parts were changed by someone else.')).toHaveCount(0);
  });
});

test.describe('AC-6: Enter moves to the next field', () => {
  test('AC-6: Enter goes through Part No., Description, Treatment / Color, QTY per Assy, Material in Drawing, Length, Width, Thickness, Part Weight and on into section 03, skips the read-only fields, and never prepares', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const address = page.url();
    await control(page, 'B').focus();
    await control(page, 'B').fill('FR-1');
    // The chain goes on through every section after 02 (STORY-05.04): the whole chain, to Remarks and the heading, is in `estimate-form-sections.spec.ts`.
    for (const next of ['D', 'G', 'H', 'E', 'J', 'K', 'L', 'N', 'P']) {
      await page.keyboard.press('Enter');
      await expect(control(page, next), `Enter should reach ${next}`).toBeFocused();
    }
    expect(page.url()).toBe(address);
    // The form was not submitted: the typed text is still there, saved by leaving its field.
    await expect(control(page, 'B')).toHaveValue('FR-1');
  });

  test('SQR-11: Enter on a part in the tree opens its form: the first field takes the focus', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await showTree(page);
    await tree(page).getByRole('link').first().focus();
    await page.keyboard.press('Enter');
    await expect(control(page, 'B')).toBeFocused();
    // On a phone the drawer has closed.
    if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Parts tree' })).toHaveCount(0);
  });
});

// DEF-049 (AQP-378): AC-9 was one test that opened the form once and took three whole-form axe scans. Measured on CI (runs 44737067927, 44546695829 and 44580739670): opening the form is 6 to 9 s on
// the development server and each whole-form scan 2.2 to 3.4 s, so the one test took 10.8 to 17.9 s on a quiet runner (run 44737067927), 19.8 to 27.1 s on a busy one, and ran out of its 30 s on the busiest (tablet, 30.2 s). It is now one
// test per state of the form (as opened, with an error showing, with a value saved), each opening the form once and taking one scan, and none of its checks is left out. A scan is never shortened: the
// same rules and tags.
test.describe('AC-9: the screen', () => {
  test('AC-9 (as opened): no sideways scroll, axe finds nothing, every control is 44 px high and every label is visible', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);

    const fieldHeight = await leastFieldHeight(page);
    for (const letter of ['A', 'B', 'D', 'H', 'E', 'F', 'J', 'K', 'L', 'N']) {
      expect((await control(page, letter).boundingBox())?.height ?? 0, letter).toBeGreaterThanOrEqual(fieldHeight);
    }
    for (const label of ['Sl. No', 'Part No.', 'Description', 'QTY per Assy', 'Material in Drawing', 'Material Considered', 'Length', 'Width', 'Thickness', 'Part Weight']) {
      await expect(partForm(page).locator('label', { hasText: label }).first(), label).toBeVisible();
    }
  });

  test('AC-9 (with an error showing): the rule is shown, there is no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await control(page, 'J').fill('-1');
    await control(page, 'J').blur();
    await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });

  test('AC-9 (with a value saved): the value is kept as 7.00, there is no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saved = nextSave(page, 'J');
    await control(page, 'J').fill('7');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'J')).toHaveValue('7.00');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });
});
