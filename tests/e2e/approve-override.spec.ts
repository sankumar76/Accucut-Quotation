import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { E2E_PASSWORD, readApproval, readEstimateState, useFreshAddress } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';

/**
 * STORY-06.07 (AC-1 to AC-8; FR-103, FR-011, FR-062, D-18; NFR-002, NFR-016 to NFR-018): a price that differs from the calculated total, with an optional reason, in SCR-08 and SCR-06, for a Lead at
 * `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and
 * opens the same address as a Lead. What they check: the warning that names the difference and the reason field (label, hint) appear only while the price differs, and go when it is the total again; no sideways
 * scroll and no axe violation in that state; an override with no reason and one with a reason are kept (the row and the audit entry, read from the database) and shown next to BO in the spec's words; a reason
 * over 500 characters, or holding a hidden character, is refused under its field in the browser and by the server with what was typed kept; a price equal to the total is no override and sends and keeps no
 * reason; a price of 0 is accepted; the Engineer sees neither the reason nor the difference. The words are the UX spec's (v0.30), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

// Test IDs: the ids of the review's button, notice and the dialog's two fields (`approve-ids.ts`, `approve-dialog.tsx`), written once.
const APPROVE_BUTTON_ID = '#review-approve';
const APPROVED_NOTICE_ID = '#review-approved-notice';
const PRICE_FIELD_ID = '#approve-price';
const REASON_FIELD_ID = '#approve-reason';
const APPROVE_ROUTE = '**/api/v1/estimates/*/approve';

const RUPEES = /^₹ [\d,]+\.\d{2}$/;
const PAISE_DIGITS = 2;
const HALF_RUPEE = 50n;
const ONE_PAISA = 1n;
const MAX_REASON = 500;
const ONE_OVER = MAX_REASON + 1;

const INFO_LINE = 'If you change the price, the difference is recorded as an override. You can add a reason for it; the reason is optional.';
const NOTE_TAIL = 'A different price is recorded as an override with your name, the time, the calculated total, the price you set and your reason, if you give one.';
const REASON_LABEL = 'Reason for the different price (Optional)';
const REASON_HINT = 'You can leave this empty. If you give one, it is kept with the override in the audit log and shown next to the Approved Quote Price. Up to 500 characters.';
const TOO_LONG_MESSAGE = 'Use 500 characters or fewer.';
const HIDDEN_CHARACTER_MESSAGE = 'Use letters, numbers and punctuation only.';
const PRICE_MESSAGE = 'Enter a price in rupees, 0 or more, with up to 2 decimals.';
const NO_REASON_GIVEN = 'No reason given.';
const REASON = 'Rounded down to a whole hundred for the customer quote.';
const ZERO_WIDTH_JOINER = '‍';

/**
 * DIAGNOSTIC ONLY (AQP-380, DEF-050); this commit is never the final head. Phase marks in ms since the case's first line, printed as one line:
 * `AQP380 <case> w=<project> start=<testInfo.duration at the first line> <phase>=<ms>... end=<ms> duration=<testInfo.duration>`.
 */
function startPhases(testInfo: TestInfo, label: string): { readonly mark: (name: string) => void; readonly print: () => void } {
  const startedAt = Date.now();
  const startDuration = testInfo.duration;
  const marks: string[] = [];
  return {
    mark: (name) => {
      marks.push(`${name}=${Date.now() - startedAt}`);
    },
    print: () => {
      // eslint-disable-next-line no-console -- diagnostic output, read from the CI log
      console.log(`AQP380 ${label} w=${testInfo.project.name} start=${Math.round(startDuration)} ${marks.join(' ')} end=${Date.now() - startedAt} duration=${Math.round(testInfo.duration)}`);
    },
  };
}

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const approveButton = (page: Page) => page.locator(APPROVE_BUTTON_ID);
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Approve and lock' });
const priceField = (page: Page) => dialogOf(page).locator(PRICE_FIELD_ID);
const reasonField = (page: Page) => dialogOf(page).locator(REASON_FIELD_ID);
const submitOf = (page: Page) => dialogOf(page).getByRole('button', { name: /^(Approve and lock|Approving)$/ });

/** A calculated estimate opened as a Lead, with the figures current and Approve and lock on. */
async function openedAsLead(page: Page, testInfo: Parameters<typeof signInAsLead>[1]) {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateAsEngineer(page, owner, code);
  await signInAsLead(page, testInfo);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
  await expect(approveButton(page)).toBeEnabled();
  await waitUntilHydrated(page, APPROVE_BUTTON_ID);
  return { owner, code };
}

/** The calculated total as the BL tile shows it ("₹ 12,629.99"), and the same without the sign and the grouping ("12629.99"): what the field starts as. */
async function totalAsShown(page: Page): Promise<string> {
  return (await tiles(page).getByText(RUPEES).first().innerText()).trim();
}
const plain = (shown: string): string => shown.replace('₹ ', '').replaceAll(',', '');

/** `total` moved by `paise` (a negative number moves it down), as rupees and paise: the price a test types. Whole-number arithmetic, independent of the product's. */
function moved(total: string, paise: bigint): string {
  const digits = (BigInt(total.replace('.', '')) + paise).toString().padStart(PAISE_DIGITS + 1, '0');
  return `${digits.slice(0, -PAISE_DIGITS)}.${digits.slice(-PAISE_DIGITS)}`;
}

async function openDialog(page: Page): Promise<Locator> {
  await approveButton(page).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await expect(priceField(page)).toBeFocused();
  return dialog;
}

/** Presses Approve and lock and waits for the server's answer to it. */
async function approveAndWait(page: Page, estimateId: string) {
  const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${estimateId}/approve`));
  await submitOf(page).click();
  return answered;
}

test.describe('AC-1: a price that differs shows the warning and the optional reason', () => {
  test('the warning names the difference, the reason field has its label and hint, and both go when the price is the total again; no sideways scroll, no axe violation', async ({ page }, testInfo) => {
    await openedAsLead(page, testInfo);
    const shown = await totalAsShown(page);
    const total = plain(shown);
    const dialog = await openDialog(page);

    // The Default state: the information line, and no reason field.
    await expect(dialog).toContainText(INFO_LINE);
    await expect(reasonField(page)).toHaveCount(0);

    await priceField(page).fill(moved(total, -HALF_RUPEE));
    await expect(dialog).toContainText(`This price is ₹ 0.50 lower than the calculated total. ${NOTE_TAIL}`);
    await expect(dialog).not.toContainText(INFO_LINE);
    await expect(reasonField(page)).toBeVisible();
    await expect(dialog.getByLabel(REASON_LABEL)).toHaveCount(1);
    await expect(dialog).toContainText(REASON_HINT);
    await expect(reasonField(page)).toHaveValue('');
    await expect(reasonField(page)).toBeEnabled();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await priceField(page).fill(moved(total, ONE_PAISA));
    await expect(dialog).toContainText(`This price is ₹ 0.01 higher than the calculated total. ${NOTE_TAIL}`);

    // The price is the total again: the note and the field go, and the information line returns.
    await priceField(page).fill(total);
    await expect(reasonField(page)).toHaveCount(0);
    await expect(dialog).toContainText(INFO_LINE);
    await expect(dialog).not.toContainText('This price is');

    // A price that is not a price is not a difference: no field either.
    await priceField(page).fill('abc');
    await expect(reasonField(page)).toHaveCount(0);
  });
});

test.describe('AC-2: an override with no reason', () => {
  test('is accepted: `is_override` is true and `override_reason` null, BO says how far it is from the total and "No reason given."', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    const shown = await totalAsShown(page);
    const lower = moved(plain(shown), -HALF_RUPEE);
    await openDialog(page);
    await priceField(page).fill(lower);
    const response = await approveAndWait(page, owner.id);
    expect(response.status()).toBe(200);
    // The answer is the status, the price and the time, and nothing of the reason or the total.
    expect(Object.keys((await response.json()) as object).sort()).toEqual(['approvedAt', 'approvedPrice', 'status']);

    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.locator(APPROVED_NOTICE_ID)).toBeVisible();
    await expect(tiles(page)).toContainText(`₹ 0.50 lower than the calculated total (${shown}).`);
    await expect(tiles(page)).toContainText(NO_REASON_GIVEN);
    await expect(tiles(page)).not.toContainText('Reason given:');
    expect(await readApproval(owner.id)).toEqual({ approvedPrice: lower, calculatedBl: plain(shown), isOverride: true, overrideReason: null, entryReason: null });
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-3, AC-7: an override with a reason', () => {
  test('the reason is kept trimmed, in the audit entry too, and shown next to BO; the Engineer sees neither it nor the difference', async ({ page }, testInfo) => {
    const phases = startPhases(testInfo, 'approve-override:155');
    try {
      const { owner, code } = await engineerWithEstimate(testInfo);
      phases.mark('made');
      await calculateAsEngineer(page, owner, code);
      phases.mark('calculated');
      await signInAsLead(page, testInfo);
      phases.mark('leadSignedIn');
      const leadOpen = await page.goto(`/estimates/${code}`);
      expect(leadOpen?.status()).toBe(200);
      phases.mark('leadGoto');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
      await expect(approveButton(page)).toBeEnabled();
      await waitUntilHydrated(page, APPROVE_BUTTON_ID);
      phases.mark('leadHydrated');
      const shown = await totalAsShown(page);
      const higher = moved(plain(shown), ONE_PAISA);
      await openDialog(page);
      phases.mark('dialogOpen');
      await priceField(page).fill(higher);
      await reasonField(page).fill(`  ${REASON}  `);
      const response = await approveAndWait(page, owner.id);
      expect(response.status()).toBe(200);
      phases.mark('approved');

      await expect(dialogOf(page)).toHaveCount(0);
      await expect(tiles(page)).toContainText(`₹ 0.01 higher than the calculated total (${shown}).`);
      await expect(tiles(page)).toContainText(`Reason given: ${REASON}`);
      await expect(tiles(page)).not.toContainText(NO_REASON_GIVEN);
      phases.mark('tilesShown');
      expect(await readApproval(owner.id)).toEqual({ approvedPrice: higher, calculatedBl: plain(shown), isOverride: true, overrideReason: REASON, entryReason: REASON });
      phases.mark('auditRead');

      // The Engineer, on the same address, is told it is approved and locked and sees no price, no difference and no reason (FR-011, NFR-002); `/costs` is refused.
      await page.context().clearCookies();
      phases.mark('cookiesCleared');
      const csrf = await page.request.get('/api/auth/csrf');
      phases.mark('csrf');
      const { csrfToken } = (await csrf.json()) as { readonly csrfToken: string };
      const credentials = await page.request.post('/api/auth/callback/credentials', { form: { csrfToken, email: owner.email, password: E2E_PASSWORD, json: 'true' } });
      expect(credentials.ok()).toBe(true);
      phases.mark('credentials');
      phases.mark('engineerSignedIn');
      const own = await page.goto(`/estimates/${code}`);
      expect(own?.status()).toBe(200);
      phases.mark('engineerGoto');
      await expect(page.getByText('Approved and locked.', { exact: true })).toBeVisible();
      const html = await page.content();
      for (const hidden of [REASON, 'than the calculated total', 'Reason given', NO_REASON_GIVEN]) expect(html, hidden).not.toContain(hidden);
      phases.mark('engineerAsserted');
      const costs = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/costs`)).status, owner.id);
      expect(costs).toBe(403);
      phases.mark('costs');
    } finally {
      phases.print();
    }
  });
});

test.describe('AC-4: a reason of 501 characters, or with a hidden character', () => {
  test('is refused under its field in the browser, with nothing sent and what was typed kept; the server refuses it too; 500 characters go through', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    const shown = await totalAsShown(page);
    const lower = moved(plain(shown), -HALF_RUPEE);
    let sent = 0;
    await page.route(APPROVE_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await openDialog(page);
    await priceField(page).fill(lower);

    // 501 characters: the spec's sentence under the field, focus on it, the text kept, nothing sent.
    await reasonField(page).fill('x'.repeat(ONE_OVER));
    await submitOf(page).click();
    await expect(dialogOf(page).getByText(TOO_LONG_MESSAGE)).toBeVisible();
    await expect(reasonField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(reasonField(page)).toBeFocused();
    await expect(reasonField(page)).toHaveValue('x'.repeat(ONE_OVER));
    await expect(priceField(page)).toHaveValue(lower);
    expect(sent).toBe(0);

    // A hidden character (a zero-width joiner, DL-219): refused the same way, with the shared sentence.
    await reasonField(page).fill(`Round${ZERO_WIDTH_JOINER}ed`);
    await submitOf(page).click();
    await expect(dialogOf(page).getByText(HIDDEN_CHARACTER_MESSAGE)).toBeVisible();
    await expect(reasonField(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });

    // The server refuses the same text itself, whatever the browser does: a 422 under `reason`, and nothing is written.
    const refused = await page.evaluate(async (id) => {
      const costs = (await (await fetch(`/api/v1/estimates/${id}/costs`)).json()) as { calculationId: string };
      const answer = await fetch(`/api/v1/estimates/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calculationId: costs.calculationId, price: '1.00', reason: 'x'.repeat(501) }),
      });
      return { status: answer.status, body: (await answer.json()) as { errors?: Array<{ field: string; message: string }> } };
    }, owner.id);
    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([{ field: 'reason', message: TOO_LONG_MESSAGE }]);
    expect(await readApproval(owner.id)).toBeNull();

    // 500 characters is the limit and is kept.
    await reasonField(page).fill('x'.repeat(MAX_REASON));
    const response = await approveAndWait(page, owner.id);
    expect(response.status()).toBe(200);
    await expect(dialogOf(page)).toHaveCount(0);
    expect(await readApproval(owner.id)).toMatchObject({ approvedPrice: lower, isOverride: true, overrideReason: 'x'.repeat(MAX_REASON), entryReason: 'x'.repeat(MAX_REASON) });
  });
});

test.describe('AC-5: a price equal to the calculated total is not an override', () => {
  test('the reason field goes with the difference and no reason is sent or kept; BO shows neither a difference nor a reason line', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    const shown = await totalAsShown(page);
    const total = plain(shown);
    const bodies: unknown[] = [];
    await page.route(APPROVE_ROUTE, async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.continue();
    });
    await openDialog(page);
    // A reason is typed for a different price, then the price goes back to the total: the field is hidden, so the reason is not sent.
    await priceField(page).fill(moved(total, -HALF_RUPEE));
    await reasonField(page).fill(REASON);
    await priceField(page).fill(total);
    await expect(reasonField(page)).toHaveCount(0);
    const response = await approveAndWait(page, owner.id);
    expect(response.status()).toBe(200);

    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0] as object).sort()).toEqual(['calculationId', 'price']);
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(tiles(page)).toContainText(shown);
    await expect(tiles(page)).not.toContainText('than the calculated total');
    await expect(tiles(page)).not.toContainText(NO_REASON_GIVEN);
    await expect(tiles(page)).not.toContainText('Reason given:');
    expect(await readApproval(owner.id)).toEqual({ approvedPrice: total, calculatedBl: total, isOverride: false, overrideReason: null, entryReason: undefined });
  });
});

test.describe('AC-6, AC-8: the price itself', () => {
  test('text is refused with the spec\'s sentence and no reason field; a price of 0 is accepted as an override', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    const shown = await totalAsShown(page);
    await openDialog(page);
    await priceField(page).fill('abc');
    await submitOf(page).click();
    await expect(dialogOf(page).getByText(PRICE_MESSAGE)).toBeVisible();
    await expect(reasonField(page)).toHaveCount(0);
    expect(await readApproval(owner.id)).toBeNull();

    await priceField(page).fill('0');
    await expect(dialogOf(page)).toContainText(`This price is ${shown} lower than the calculated total.`);
    const response = await approveAndWait(page, owner.id);
    expect(response.status()).toBe(200);
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(tiles(page)).toContainText('₹ 0.00');
    await expect(tiles(page)).toContainText(`${shown} lower than the calculated total (${shown}).`);
    expect(await readApproval(owner.id)).toMatchObject({ approvedPrice: '0.00', isOverride: true, overrideReason: null });
  });
});
