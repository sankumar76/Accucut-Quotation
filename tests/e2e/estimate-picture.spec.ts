import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { PLAIN_TEXT, pngOfSize, SVG_TEXT } from '../support/pictures';

import { useFreshAddress } from './support/auth';
import { horizontalOverflow, TOUCH_TARGET } from './support/design-system';
import { control, expectFormAccessible, isPatchOfInputs, openForm } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-05.07 T8 (AC-1 to AC-3, AC-5, AC-6, AC-8): the part picture of SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a
 * person of its own, who owns a task with an empty draft estimate and one part (the recipe of the confidentiality scan), chooses the customer so the form opens, and adds, replaces
 * and removes the picture of the part by the file picker (with the keyboard too), by paste and by drop. The words are the UX spec's and the story's, written out here and not
 * imported. The files are made from invented bytes (`tests/support/pictures.ts`), never a photograph. The server's own judgement of a file (413, 415, the cap on the whole body) is
 * asked directly, bypassing the screen's quick check. What the database holds (the immutable rows, the revisions, the lock) is judged in `tests/integration/estimates/image.test.ts`.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

// The picture field is its own file, fetched when the form opens, and the development server compiles it the first time it is asked for: the first test of a run can wait several seconds for it.
test.beforeEach(() => {
  test.setTimeout(60_000);
});

/** Opens the form as `openForm` does, and waits for the picture field, which arrives after the form (a separate chunk). Answers the person. */
async function open(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  const owner = await openForm(page, testInfo);
  await expect(zone(page)).toBeVisible({ timeout: 45_000 });
  return owner;
}

const KB = 1024;
/**
 * A picture that no part holds. The canary picture of the scan's estimate is `smallPng()` (`insertCanaryEstimate`), so the same bytes would be found and not stored again, and would show the
 * name the canary was stored with (that is the one row per picture of an estimate, ADR-013); every test here adds this one, or one of another size, instead.
 */
const fresh = (): Buffer => pngOfSize(120);
const HINT = 'PNG, JPG, GIF or WebP, under 200 KB.';
const WRONG_TYPE = 'Only PNG, JPG, GIF or WebP pictures are accepted.';
const tooLarge = (name: string, kilobytes: number): string => `"${name}" is ${String(kilobytes)} KB. Pictures must be under 200 KB. Choose a smaller picture.`;

const isPictureWrite = (url: string, method: string): boolean => (method === 'PUT' || method === 'DELETE') && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+\/image$/.test(new URL(url).pathname);
const writeOfPicture = (page: Page, method: 'PUT' | 'DELETE') => page.waitForResponse((response) => isPictureWrite(response.url(), response.request().method()) && response.request().method() === method);

const section = (page: Page): Locator => page.getByRole('region', { name: '01 Part Details' });
const zone = (page: Page): Locator => section(page).getByRole('group', { name: /Part Model/ });
const chooser = (page: Page): Locator => zone(page).locator('input[type="file"]');
const preview = (page: Page, name: string): Locator => zone(page).getByRole('img', { name: `Picture of the part: ${name}` });

const file = (name: string, buffer: Uint8Array, mimeType = 'image/png') => ({ name, mimeType, buffer: Buffer.from(buffer) });

/** Adds a picture by the file picker and waits for the answer. */
async function choose(page: Page, name: string, bytes: Uint8Array): Promise<number> {
  const written = writeOfPicture(page, 'PUT');
  await chooser(page).setInputFiles(file(name, bytes));
  return (await written).status();
}

/** A picture pasted as a browser delivers it: a `paste` event whose clipboard holds one file. */
async function paste(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page.evaluate(
    ({ base64, fileName }) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], fileName, { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    },
    { base64: Buffer.from(bytes).toString('base64'), fileName: name },
  );
}

/** A picture dropped on the field, as a browser delivers it. */
async function drop(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await zone(page).evaluate(
    (element, { base64, fileName }) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], fileName, { type: 'image/png' }));
      element.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }));
      element.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
    },
    { base64: Buffer.from(bytes).toString('base64'), fileName: name },
  );
}

const ownerRoute = (owner: { readonly id: string }): string => `/api/v1/estimates/${owner.id}/nodes/${owner.id}/image`;

test.describe('AC-1, AC-3: the field and the three ways to add a picture', () => {
  test('AC-3: Part Model is labelled "Optional", says how to add a picture, shows no message and no "missing picture", and is not counted as a required input', async ({ page }, testInfo) => {
    await open(page, testInfo);
    await expect(zone(page)).toBeVisible();
    // The label sits above the box and names it: "Excel column C Part Model Optional".
    await expect(zone(page)).toHaveAccessibleName(/^Excel column C\s+Part Model\s+Optional$/);
    await expect(section(page)).toContainText('Optional');
    await expect(zone(page)).toContainText('Paste, drop a picture here, or choose a file.');
    await expect(zone(page).getByRole('button', { name: 'Choose a file' })).toBeVisible();
    await expect(section(page)).toContainText(HINT);
    await expect(zone(page)).toHaveAccessibleDescription(HINT);
    await expect(section(page).getByRole('alert')).toHaveCount(0);
    // Not counted: the card's count is the four fields it needs (Part No., Description, Treatment / Color, QTY per Assy), whatever the picture.
    await expect(section(page)).toContainText('0 of 4 complete');
    expect(await page.locator('body').innerText()).not.toMatch(/missing picture|picture (is )?(required|missing)/i);
  });

  test('AC-1: choosing a file stores it and shows a preview with its name; it is still there after a reload', async ({ page }, testInfo) => {
    await open(page, testInfo);
    expect(await choose(page, 'invented-front.png', fresh())).toBe(200);
    await expect(zone(page)).toContainText('invented-front.png');
    await expect(preview(page, 'invented-front.png')).toBeVisible();
    // The preview is a picture the server sent: a 1 x 1 image has a natural width of 1.
    await expect(preview(page, 'invented-front.png')).toHaveJSProperty('naturalWidth', 1);
    await expect(section(page).getByRole('alert')).toHaveCount(0);
    await expect(section(page)).toContainText('0 of 4 complete');

    await page.reload();
    await expect(control(page, 'J')).toBeEnabled();
    await expect(zone(page)).toContainText('invented-front.png');
    await expect(preview(page, 'invented-front.png')).toHaveJSProperty('naturalWidth', 1);
  });

  test('AC-1: Replace shows the new picture, and Remove takes it away and offers the field again; the same keys and buttons work each time', async ({ page }, testInfo) => {
    await open(page, testInfo);
    await choose(page, 'first.png', fresh());
    await expect(zone(page).getByRole('button', { name: 'Replace' })).toBeVisible();
    await expect(zone(page).getByRole('button', { name: 'Remove' })).toBeVisible();
    expect(await choose(page, 'second.png', pngOfSize(300))).toBe(200);
    await expect(zone(page)).toContainText('second.png');
    await expect(zone(page)).not.toContainText('first.png');

    const removed = writeOfPicture(page, 'DELETE');
    await zone(page).getByRole('button', { name: 'Remove' }).click();
    expect((await removed).status()).toBe(200);
    await expect(zone(page)).toContainText('Paste, drop a picture here, or choose a file.');
    await expect(zone(page).getByRole('img')).toHaveCount(0);
    await expect(zone(page).getByRole('button', { name: 'Choose a file' })).toBeVisible();
    // A part with no picture is whole (D-31): nothing is said about one.
    await expect(section(page).getByRole('alert')).toHaveCount(0);
  });

  test('AC-1: a copied picture is added by pasting (Ctrl+V), and a picture is added by dropping it on the field; a paste of text is left alone', async ({ page }, testInfo) => {
    await open(page, testInfo);
    const pasted = writeOfPicture(page, 'PUT');
    await paste(page, 'image.png', fresh());
    expect((await pasted).status()).toBe(200);
    await expect(zone(page)).toContainText('image.png');

    const dropped = writeOfPicture(page, 'PUT');
    await drop(page, 'dropped-side.png', pngOfSize(400));
    expect((await dropped).status()).toBe(200);
    await expect(zone(page)).toContainText('dropped-side.png');

    // Text pasted into a field goes into the field, as it always did, and no picture is sent.
    let sent = 0;
    page.on('request', (request) => {
      if (isPictureWrite(request.url(), request.method())) sent += 1;
    });
    await control(page, 'B').click();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'FR-12');
      document.activeElement?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    expect(sent).toBe(0);
  });

  test('AC-1, AC-8: it can be done without a mouse: Enter on "Choose a file" opens the file picker, and Remove is a button too', async ({ page }, testInfo) => {
    await open(page, testInfo);
    const choose = zone(page).getByRole('button', { name: 'Choose a file' });
    await choose.focus();
    await expect(choose).toBeFocused();
    // The press goes through the button's own locator (AQP-340): it takes focus again if the page re-rendered or moved it since the line above, and presses on that button with the keyboard. The page's keyboard presses on
    // whatever has focus at that moment. The first attempt of this test waited out its 60 s on the picker in every width of a full run and never when this spec ran alone (948 runs); a lost focus under load is the likely
    // cause and is not proven by a trace, so a recurrence is to be reported with its trace.
    const [picker] = await Promise.all([page.waitForEvent('filechooser'), choose.press('Enter')]);
    const written = writeOfPicture(page, 'PUT');
    await picker.setFiles(file('keyboard.png', fresh()));
    expect((await written).status()).toBe(200);
    await expect(zone(page)).toContainText('keyboard.png');

    const remove = zone(page).getByRole('button', { name: 'Remove' });
    await remove.focus();
    const removed = writeOfPicture(page, 'DELETE');
    await page.keyboard.press('Enter');
    expect((await removed).status()).toBe(200);
    await expect(zone(page)).toContainText('Paste, drop a picture here, or choose a file.');
  });

  test('a part that has a picture still saves what is typed: the part\'s revision moved with the picture and the form kept in step', async ({ page }, testInfo) => {
    await open(page, testInfo);
    await choose(page, 'step.png', fresh());
    const saved = page.waitForResponse((response) => isPatchOfInputs(response.url(), response.request().method()));
    await control(page, 'B').fill('FR-7');
    await control(page, 'B').blur();
    expect((await saved).status()).toBe(200);
    await expect(section(page).getByRole('alert')).toHaveCount(0);
    // And a picture added after a value was saved is accepted: the other way round.
    expect(await choose(page, 'after.png', pngOfSize(300))).toBe(200);
  });
});

test.describe('AC-2: what is refused, in the words of SCR-05, inline in section 01', () => {
  test('a text file renamed .png and an SVG are refused as the wrong type, and a file of 0 bytes too; nothing is sent and the form is untouched', async ({ page }, testInfo) => {
    await open(page, testInfo);
    let sent = 0;
    page.on('request', (request) => {
      if (isPictureWrite(request.url(), request.method())) sent += 1;
    });
    for (const [name, bytes, type] of [
      ['notes.png', PLAIN_TEXT, 'image/png'],
      ['logo.svg', SVG_TEXT, 'image/svg+xml'],
      ['empty.png', Buffer.alloc(0), 'image/png'],
    ] as const) {
      await chooser(page).setInputFiles({ name, mimeType: type, buffer: Buffer.from(bytes) });
      await expect(section(page).getByRole('alert')).toContainText(WRONG_TYPE);
      await expect(zone(page)).toContainText('Paste, drop a picture here, or choose a file.');
    }
    expect(sent).toBe(0);
  });

  test('a picture of 201 KB is refused with its name and size and the limit; 199 KB is accepted; the picture that was there stays after a refusal', async ({ page }, testInfo) => {
    await open(page, testInfo);
    await choose(page, 'first.png', fresh());
    await chooser(page).setInputFiles(file('cabinet-photo.png', pngOfSize(201 * KB)));
    await expect(section(page).getByRole('alert')).toContainText(tooLarge('cabinet-photo.png', 201));
    await expect(zone(page)).toContainText('first.png');

    expect(await choose(page, 'under-the-limit.png', pngOfSize(199 * KB))).toBe(200);
    await expect(zone(page)).toContainText('under-the-limit.png');
    // A message goes when the next change is made.
    await expect(section(page).getByRole('alert')).toHaveCount(0);
  });

  test('204,800 bytes exactly is refused and 204,799 is accepted: the limit is strictly under 200 x 1024 bytes', async ({ page }, testInfo) => {
    await open(page, testInfo);
    await chooser(page).setInputFiles(file('exact.png', pngOfSize(204_800)));
    await expect(section(page).getByRole('alert')).toContainText(tooLarge('exact.png', 200));
    expect(await choose(page, 'edge.png', pngOfSize(204_799))).toBe(200);
  });

  test('AC-7: a file name with markup and path characters is shown as text, sanitised', async ({ page }, testInfo) => {
    await open(page, testInfo);
    expect(await choose(page, '..\\<b>front</b>.png', fresh())).toBe(200);
    // The slash of the closing tag is a path separator, so only what follows it is kept; nothing of it is markup.
    await expect(zone(page)).toContainText('b.png');
    expect(await zone(page).innerHTML()).not.toMatch(/<b>front/);
    await expect(zone(page).locator('b')).toHaveCount(0);
  });
});

test.describe('AC-2, AC-5, AC-6: the server judges again and serves the picture to its owner only', () => {
  test('the server refuses a wrong type with 415 and a large picture with 413, by content and by size, and a body over 256 KB with 413; nothing is stored', async ({ page }, testInfo) => {
    const owner = await open(page, testInfo);
    const put = (name: string, mimeType: string, bytes: Uint8Array) =>
      // `maxRetries` repeats the call only if the connection is reset. The server refuses a body over its cap before reading it (413), and a client still sending the rest can see the connection reset first (AQP-340);
      // the refusal asserted below is the server's answer to the repeat.
      page.request.put(ownerRoute(owner), { headers: { origin: DEVELOPMENT_URL }, multipart: { file: { name, mimeType, buffer: Buffer.from(bytes) } }, maxRetries: 3 });
    for (const [name, type, bytes] of [
      ['notes.png', 'image/png', PLAIN_TEXT],
      ['logo.svg', 'image/svg+xml', SVG_TEXT],
      ['empty.png', 'image/png', Buffer.alloc(0)],
      ['declared-as-png.png', 'image/png', Buffer.concat([fresh(), Buffer.from('<script>alert(1)</script>')])],
    ] as const) {
      const answer = await put(name, type, bytes);
      expect(answer.status(), name).toBe(415);
      expect(await answer.json()).toMatchObject({ code: 'PICTURE_TYPE_REFUSED', title: WRONG_TYPE });
    }
    const large = await put('cabinet-photo.png', 'image/png', pngOfSize(201 * KB));
    expect(large.status()).toBe(413);
    expect(await large.json()).toMatchObject({ code: 'PICTURE_TOO_LARGE', title: tooLarge('cabinet-photo.png', 201) });
    const over = await put('huge.png', 'image/png', pngOfSize(400 * KB));
    expect(over.status()).toBe(413);
    // A type is read from the content and not from the declared type: a PNG declared as text is accepted.
    expect((await put('plain-declared.png', 'text/plain', fresh())).status()).toBe(200);
  });

  test('the picture is served with its stored type, nosniff and no-store to its owner; signed out is 401, and an ID that is not a picture is 404', async ({ page, playwright }, testInfo) => {
    const owner = await open(page, testInfo);
    await choose(page, 'served.png', fresh());
    const part = await page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}`);
    const body: unknown = await part.json();
    const pictureId = typeof body === 'object' && body !== null && 'picture' in body && typeof body.picture === 'object' && body.picture !== null && 'id' in body.picture ? String(body.picture.id) : '';
    expect(pictureId).not.toBe('');

    const served = await page.request.get(`/api/v1/images/${pictureId}`);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toBe('image/png');
    expect(served.headers()['x-content-type-options']).toBe('nosniff');
    expect(served.headers()['cache-control']).toContain('no-store');
    expect(served.headers()['content-disposition']).toBe('inline');
    expect((await served.body()).equals(Buffer.from(fresh()))).toBe(true);

    expect((await page.request.get('/api/v1/images/00000000-0000-4000-8000-0000000000ff')).status()).toBe(404);
    expect((await page.request.get('/api/v1/images/not-an-id')).status()).toBe(404);

    const anonymous = await playwright.request.newContext({ baseURL: DEVELOPMENT_URL });
    try {
      expect((await anonymous.get(`/api/v1/images/${pictureId}`)).status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });
});

test.describe('AC-8: small screens and accessibility', () => {
  test('the messages are inline in section 01 with role="alert", the buttons are touch targets, nothing scrolls sideways, and axe finds nothing, with a picture and with a message', async ({ page }, testInfo) => {
    await open(page, testInfo);
    await choose(page, 'accessible.png', fresh());
    await expectFormAccessible(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    for (const name of ['Replace', 'Remove']) {
      const box = await zone(page).getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }

    await chooser(page).setInputFiles(file('cabinet-photo.png', pngOfSize(201 * KB)));
    const alert = section(page).getByRole('alert');
    await expect(alert).toContainText(tooLarge('cabinet-photo.png', 201));
    await expect(alert).toBeVisible();
    await expectFormAccessible(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
