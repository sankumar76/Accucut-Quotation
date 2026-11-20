import { describe, expect, it, vi } from 'vitest';

import { saveAlertSettings, saveResultOf, sendTestEmail, testResultOf } from '@/lib/settings/alerts-client';

/**
 * STORY-09.02 AC-3 to AC-5: the browser's side of `PUT /api/v1/settings` and `POST /api/v1/settings/test-email`. It takes `fetch` as an argument, so each test answers for the server. What
 * matters: the request that is sent (the test e-mail has no body), the reading of a good answer, of a 422 with its field messages, of a 502 with its class code (which the shared
 * client used to turn into "failed" for every 5xx), and that a network fault, a 500 and an answer of the wrong shape are all "failed" and never a crash. Every value is invented.
 */

const SAVED = { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' };

function answer(status: number, body: unknown, contentType = 'application/json'): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })));
}

const problemBody = (status: number, code: string, extra: Record<string, unknown> = {}): unknown => ({ type: 'about:blank', title: 'A title.', status, code, requestId: 'req-00000000', ...extra });

describe('the requests', () => {
  it('saves with PUT and a JSON body of the three values and nothing else', async () => {
    const doFetch = answer(200, { ...SAVED, emailEnabled: false });
    const outcome = await saveAlertSettings(SAVED, doFetch);
    expect(outcome).toEqual({ status: 'ok', value: SAVED });
    expect(doFetch).toHaveBeenCalledWith('/api/v1/settings', expect.objectContaining({ method: 'PUT', body: JSON.stringify(SAVED), credentials: 'same-origin' }));
  });

  it('sends the test e-mail with POST and no body, and reads the address it went to', async () => {
    const doFetch = answer(200, { sentTo: 'admin.own@example.com' });
    expect(await sendTestEmail(doFetch)).toEqual({ status: 'ok', value: 'admin.own@example.com' });
    const [path, init] = vi.mocked(doFetch).mock.calls[0] ?? [];
    expect(path).toBe('/api/v1/settings/test-email');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init?.body).toBeUndefined();
  });
});

describe('AC-3: the answer to Save', () => {
  it('a saved row is "saved" with the values as stored', async () => {
    expect(saveResultOf(await saveAlertSettings(SAVED, answer(200, { ...SAVED, emailEnabled: true })))).toEqual({ kind: 'saved', saved: SAVED });
  });

  it('a 422 puts the message of each field under its field', async () => {
    const body = problemBody(422, 'VALIDATION_FAILED', {
      errors: [
        { field: 'senderName', message: 'Enter a sender name.' },
        { field: 'senderAddress', message: 'Enter a valid e-mail address, for example portal@example.com.' },
      ],
    });
    expect(saveResultOf(await saveAlertSettings(SAVED, answer(422, body, 'application/problem+json')))).toEqual({
      kind: 'fields',
      problems: { senderName: 'Enter a sender name.', senderAddress: 'Enter a valid e-mail address, for example portal@example.com.' },
    });
  });

  it('a 422 that names no field of this form, a 500, a 403, a network fault and a wrong shape are all "failed"', async () => {
    expect(saveResultOf(await saveAlertSettings(SAVED, answer(422, problemBody(422, 'VALIDATION_FAILED', { errors: [{ field: 'other', message: 'x' }] }), 'application/problem+json')))).toEqual({ kind: 'failed' });
    expect(saveResultOf(await saveAlertSettings(SAVED, answer(500, problemBody(500, 'INTERNAL'), 'application/problem+json')))).toEqual({ kind: 'failed' });
    expect(saveResultOf(await saveAlertSettings(SAVED, answer(403, problemBody(403, 'FORBIDDEN'), 'application/problem+json')))).toEqual({ kind: 'failed' });
    expect(saveResultOf(await saveAlertSettings(SAVED, vi.fn(() => Promise.reject(new Error('offline')))))).toEqual({ kind: 'failed' });
    expect(saveResultOf(await saveAlertSettings(SAVED, answer(200, { unexpected: true })))).toEqual({ kind: 'failed' });
  });
});

describe('AC-4, AC-5: the answer to Send test e-mail', () => {
  it('a sent message is "sent" with the address', async () => {
    expect(testResultOf(await sendTestEmail(answer(200, { sentTo: 'admin.own@example.com' })))).toEqual({ kind: 'sent', sentTo: 'admin.own@example.com' });
  });

  it('a 502 SENDER_NOT_ALLOWED is its own result, so the page shows the SCR-15 sentence and keeps the sender editable', async () => {
    expect(testResultOf(await sendTestEmail(answer(502, problemBody(502, 'SENDER_NOT_ALLOWED'), 'application/problem+json')))).toEqual({ kind: 'sender-not-allowed' });
  });

  it.each(['AUTH_FAILED', 'CONNECTION', 'UNKNOWN'])('a 502 %s is "failed" (the page says "Test failed" and shows no code)', async (code) => {
    expect(testResultOf(await sendTestEmail(answer(502, problemBody(502, code), 'application/problem+json')))).toEqual({ kind: 'failed' });
  });

  it('a 422 NO_SENDER is its own result', async () => {
    expect(testResultOf(await sendTestEmail(answer(422, problemBody(422, 'NO_SENDER'), 'application/problem+json')))).toEqual({ kind: 'no-sender' });
  });

  it('a 500, a network fault and an answer of the wrong shape are "failed"', async () => {
    expect(testResultOf(await sendTestEmail(answer(500, problemBody(500, 'INTERNAL'), 'application/problem+json')))).toEqual({ kind: 'failed' });
    expect(testResultOf(await sendTestEmail(vi.fn(() => Promise.reject(new Error('offline')))))).toEqual({ kind: 'failed' });
    expect(testResultOf(await sendTestEmail(answer(200, { sentTo: 5 })))).toEqual({ kind: 'failed' });
  });
});
