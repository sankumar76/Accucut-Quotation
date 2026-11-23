import { randomBytes } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { openMailCapture, type MailCapture } from '../../support/mail-capture';

/**
 * DEF-064 (Jira AQP-412, GitHub #639; DL-305 (5), DL-325 (7) Ruling F): a test's read of the shared Mailpit can never lose a message that another file, or Mailpit itself, removes
 * while it reads. Two captures stand for two test files that share one Mailpit.
 *
 *   - Before the fix, a capture listed the whole inbox and then fetched each message by ID, so a message another file removed between the list and the fetch answered 404 and failed
 *     the reading file ("Mailpit answered 404 for GET /api/v1/message/<id>", seen on the daily-digest tests three times in about 12 hours).
 *   - A capture now asks Mailpit for its own tag only, so it never lists, nor fetches, a message of another capture.
 *   - A message of its own that is gone is not skipped: the read still fails, because a test must not pass on a mail that is not there.
 *
 * The removals here are Mailpit's delete-by-search of one unique subject (never a delete of the whole inbox), made through the API at the exact moment the capture has listed and not
 * yet fetched. They need the real Mailpit, which every CI run has; a machine without one runs the stub-only checks and skips the rest. Every address and subject is invented.
 */

vi.setConfig({ testTimeout: 30_000 });

const apiUrl = (process.env['MAILPIT_API_URL'] ?? '').replace(/\/+$/, '');
const hasMailpit = apiUrl !== '';
const realFetch = globalThis.fetch;

/** Unique to this run, so a long-lived local Mailpit that kept an earlier run's messages cannot mix in. */
const RUN = randomBytes(6).toString('hex');
const subjectOf = (owner: string, index: number): string => `Isolation ${RUN} ${owner} ${index}`;

async function send(capture: MailCapture, subject: string): Promise<void> {
  await capture.transport.sendMail({ from: 'portal@example.com', to: 'someone@example.com', subject, text: `Invented body for ${subject}.` });
}

async function sendAll(capture: MailCapture, owner: string, count: number): Promise<ReadonlyArray<string>> {
  const subjects = Array.from({ length: count }, (_, index) => subjectOf(owner, index));
  for (const subject of subjects) await send(capture, subject);
  return subjects;
}

/** Removes the one message with this subject, the way another file or Mailpit's own pruning would: by search, never the whole inbox. */
async function removeBySubject(subject: string): Promise<void> {
  const response = await realFetch(`${apiUrl}/api/v1/search?query=${encodeURIComponent(`subject:"${subject}"`)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} when the test removed "${subject}".`);
}

/**
 * Lets the capture's first list request through (a search of its tag, or, before the fix, a list of the whole inbox), then runs `removal` before its next request: the window in which
 * another file's delete used to give a 404. Returns whether the window was reached, so a test can say that the removal really happened.
 */
function removeAfterFirstSearch(removal: () => Promise<void>): { readonly reached: () => boolean } {
  let reached = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const response = await realFetch(input, init);
    if (!reached && /\/api\/v1\/(search|messages)\?/.test(String(input))) {
      reached = true;
      await removal();
    }
    return response;
  });
  return { reached: () => reached };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a capture reads only its own messages', () => {
  it('two captures that send the same subject to the same address each read their own count, in the order sent', async () => {
    const first = openMailCapture();
    const second = openMailCapture();
    const subject = subjectOf('same', 0);
    await send(first, subject);
    await send(second, subject);
    await send(second, subject);

    const own = (await first.list()).filter((mail) => mail.subject === subject);
    const other = (await second.list()).filter((mail) => mail.subject === subject);
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(2);
  });

  it('a capture that sent nothing reads nothing, whatever other captures sent', async () => {
    const sender = openMailCapture();
    const reader = openMailCapture();
    await sendAll(sender, 'sender', 2);
    expect(await reader.list()).toEqual([]);
  });
});

// Without this, a CI run that lost its Mailpit service would skip the checks below and pass.
it.runIf(process.env['CI'] !== undefined)('a CI run has its Mailpit service, so the removal checks below run', () => {
  expect(hasMailpit).toBe(true);
});

describe.skipIf(!hasMailpit)('a message removed while a capture reads (Mailpit)', () => {
  it("DEF-064: another file's messages are removed between the list and the fetch, and the read still returns every message of its own", async () => {
    const reading = openMailCapture();
    const other = openMailCapture();
    const mine = await sendAll(reading, 'reading', 3);
    const theirs = await sendAll(other, 'other', 3);

    const inRead = removeAfterFirstSearch(async () => {
      for (const subject of theirs) await removeBySubject(subject);
    });
    const read = await reading.list();
    vi.restoreAllMocks();

    expect(inRead.reached(), 'the removal ran inside the read').toBe(true);
    expect(read.map((mail) => mail.subject)).toEqual(mine);
    // The removal did happen: the other capture reads none of its three any more.
    expect((await other.list()).filter((mail) => theirs.includes(mail.subject))).toEqual([]);
  });

  it('a message of its own that goes missing during the read is not skipped: the read fails, so a test cannot pass on a mail that is not there', async () => {
    const reading = openMailCapture();
    const mine = await sendAll(reading, 'lost', 3);

    removeAfterFirstSearch(() => removeBySubject(mine[1] ?? ''));

    await expect(reading.list()).rejects.toThrow(/Mailpit answered 404 for GET \/api\/v1\/message\//);
  });
});
