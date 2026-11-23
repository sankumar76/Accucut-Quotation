import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ESTIMATE_IGNORED_CODE, ALREADY_IGNORED_CODE, NOT_IGNORED_CODE } from '@/components/features/estimate-ignore/ignore-codes';
import { ACTIONS_BAR_ID } from '@/components/features/estimate-ignore/ignore-ids';
import {
  engineerNoticeTitle,
  IGNORE_INTRO,
  IGNORE_UNCONFIRMED,
  ignoredNoticeBody,
  ignoredNoticeTitle,
  ignoredStatusLine,
  ignoreTitle,
  REMARKS_HINT,
  restoredStatusLine,
  restoreLines,
  RESTORE_UNCONFIRMED,
  restoreTitle,
} from '@/components/features/estimate-ignore/ignore-texts';
import { EngineerIgnoredNotice } from '@/components/features/estimate-ignore/engineer-ignored-notice';
import { IgnoredNotice } from '@/components/features/estimate-ignore/ignored-notice';
import { REVIEW_ACTIONS_ID } from '@/components/features/estimate-quote/mark-quoted-ids';
import { IGNORE_REMARKS_MAX_LENGTH } from '@/lib/estimate/ignore-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';

/**
 * CR-01 item 7D, AC-8 (AQP-401; the ux-expert's comment 12944, sections 2 to 4): the words of the two notices and the dialogs, written out here from the design of record and not imported, so a changed sentence fails a
 * test; the two notices rendered to markup with no browser; and the three codes the browser spells, held equal to the state machine's. The behaviour in a browser (the dialogs, focus, the 409 alert, axe, the widths) is
 * `tests/e2e/ignore-restore.spec.ts`. Every name, code and date is invented.
 */

// The Restore button reads the router, which a static render has not.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const IGNORED = { at: '2026-11-05T06:35:00.000Z', byName: 'Kiran Bose', remarks: 'Not taken forward.\nThe customer chose another supplier.' };
const FACTS = { status: 'APPROVED', engineerName: 'Priya Nair', deadlineLabel: '02 Nov 2026, 17:00 IST', deadlinePassed: true } as const;

describe('the codes the browser spells are the state machine\'s', () => {
  it('holds the three codes equal to the ones the refusals table writes', () => {
    expect(ALREADY_IGNORED_CODE).toBe(TRANSITION_REFUSALS.ALREADY_IGNORED.code);
    expect(NOT_IGNORED_CODE).toBe(TRANSITION_REFUSALS.NOT_IGNORED.code);
    expect(ESTIMATE_IGNORED_CODE).toBe(TRANSITION_REFUSALS.IGNORED.code);
  });

  it('holds the action bar\'s id equal to the review\'s, which focus returns to when a button leaves', () => {
    expect(ACTIONS_BAR_ID).toBe(REVIEW_ACTIONS_ID);
  });
});

describe('the words of the dialogs (12944 sections 2 and 3)', () => {
  it('the Ignore dialog: title, text and hint, the hint reading the one constant of the limit', () => {
    expect(ignoreTitle('Q-2026-0318')).toBe('Ignore Q-2026-0318?');
    expect(IGNORE_INTRO).toBe(
      'Use this when an RFQ is not taken forward or is rejected. It leaves Open and Overdue and is listed under Ignored. While it is ignored it is read-only: nobody can change, calculate, approve, mark as quoted or download it. Nothing in the estimate is deleted, and you can restore it later.',
    );
    expect(REMARKS_HINT).toBe('Why this RFQ is set aside. The Engineer can read this in their Ignored tab, and it is kept in the audit log. Up to 500 characters.');
    expect(REMARKS_HINT).toContain(String(IGNORE_REMARKS_MAX_LENGTH));
    expect(IGNORE_UNCONFIRMED).toBe(
      'We could not confirm that the RFQ was ignored. It may have gone through, and the page is being updated to show it. If this window stays open, press Ignore RFQ again. An RFQ can only be ignored once, so pressing again cannot ignore it twice.',
    );
  });

  it('the Restore dialog: title, the lost-answer sentence', () => {
    expect(restoreTitle('Q-2026-0318')).toBe('Restore Q-2026-0318?');
    expect(RESTORE_UNCONFIRMED).toBe(
      'We could not confirm that the RFQ was restored. It may have gone through, and the page is being updated to show it. If this window stays open, press Restore RFQ again. An RFQ can only be restored once, so pressing again cannot restore it twice.',
    );
  });

  it.each([
    ['DRAFT', false, ['It goes back to Draft, the status it had when it was ignored, and returns to Priya Nair\'s Open queue. Nothing in the estimate changes.']],
    ['PREPARED', false, ['It goes back to Prepared, the status it had when it was ignored, and returns to Priya Nair\'s Open queue. Nothing in the estimate changes.']],
    [
      'PREPARED',
      true,
      [
        'It goes back to Prepared, the status it had when it was ignored, and returns to Priya Nair\'s Open queue. Nothing in the estimate changes.',
        'Its deadline, 02 Nov 2026, 17:00 IST, has passed, so it will also show as Overdue.',
      ],
    ],
    ['DRAFT', true, ['It goes back to Draft, the status it had when it was ignored, and returns to Priya Nair\'s Open queue. Nothing in the estimate changes.', 'Its deadline, 02 Nov 2026, 17:00 IST, has passed, so it will also show as Overdue.']],
    ['APPROVED', false, ['It goes back to Approved, the status it had when it was ignored, and returns to the Closed tab. Nothing in the estimate changes.']],
    // An Approved task is closed, so it is never overdue: the Overdue sentence is not said, even past the deadline.
    ['APPROVED', true, ['It goes back to Approved, the status it had when it was ignored, and returns to the Closed tab. Nothing in the estimate changes.']],
  ] as const)('the Restore text for %s (deadline passed: %s)', (status, deadlinePassed, lines) => {
    expect(restoreLines({ status, engineerName: 'Priya Nair', deadlineLabel: '02 Nov 2026, 17:00 IST', deadlinePassed })).toEqual(lines);
  });

  it('the polite statuses, exact, and by the status the estimate came back as', () => {
    expect(ignoredStatusLine('Q-2026-0318')).toBe('Q-2026-0318 ignored. It is now in the Ignored tab.');
    expect(restoredStatusLine('Q-2026-0318', 'PREPARED')).toBe('Q-2026-0318 restored. It is back as Prepared, in Open.');
    expect(restoredStatusLine('Q-2026-0318', 'DRAFT')).toBe('Q-2026-0318 restored. It is back as Draft, in Open.');
    expect(restoredStatusLine('Q-2026-0318', 'APPROVED')).toBe('Q-2026-0318 restored. It is back as Approved, in Closed.');
  });
});

describe('the Lead\'s and the Admin\'s notice on SCR-06 (12944 section 2)', () => {
  const html = (facts: { status?: 'DRAFT' | 'PREPARED' | 'APPROVED' } = {}): string =>
    renderToStaticMarkup(
      createElement(IgnoredNotice, { ignored: IGNORED, estimateId: 'e1', code: 'Q-2026-0318', restoreButtonId: 'review-restore', restoreLabel: 'Restore RFQ', restoreFailedLine: 'It did not open.', ...FACTS, ...facts }),
    );

  it('is a status with who, when in IST, and the remarks with their line breaks kept', () => {
    const markup = html();
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Ignored on 05 Nov 2026, 12:05 IST by Kiran Bose.');
    expect(markup).toContain('Remarks: ');
    expect(markup).toContain('whitespace-pre-wrap');
    expect(markup).toContain('Not taken forward.\nThe customer chose another supplier.');
    expect(ignoredNoticeTitle('05 Nov 2026, 12:05 IST', 'Kiran Bose')).toBe('Ignored on 05 Nov 2026, 12:05 IST by Kiran Bose.');
  });

  it.each([
    ['DRAFT', 'It was Draft when it was ignored. Restore puts it back as Draft.'],
    ['PREPARED', 'It was Prepared when it was ignored. Restore puts it back as Prepared.'],
    ['APPROVED', 'It was Approved when it was ignored. Restore puts it back as Approved.'],
  ] as const)('says the status underneath for a %s estimate: the read-only sentence, then what Restore does', (status, tail) => {
    const expected = `This RFQ is read-only. It cannot be changed, calculated, approved, marked as quoted or downloaded until it is restored. ${tail}`;
    expect(ignoredNoticeBody(status)).toBe(expected);
    expect(html({ status })).toContain(expected);
  });

  it('has the one button, "Restore RFQ", which opens a dialog and restores nothing by itself, and no dialog text in the page (NFR-009)', () => {
    const markup = html();
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain('id="review-restore"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('>Restore RFQ</button>');
    for (const word of ['Keep it ignored', 'Restore Q-2026-0318?', 'It goes back to', 'We could not confirm']) expect(markup, word).not.toContain(word);
  });

  it('draws the remarks as a text node: markup in them shows as typed', () => {
    const markup = html();
    const planted = renderToStaticMarkup(
      createElement(IgnoredNotice, { ignored: { ...IGNORED, remarks: '<b>x</b> & <script>' }, estimateId: 'e1', code: 'Q-2026-0318', restoreButtonId: 'review-restore', restoreLabel: 'Restore RFQ', restoreFailedLine: 'x', ...FACTS }),
    );
    expect(markup).not.toContain('<b>');
    expect(planted).toContain('&lt;b&gt;x&lt;/b&gt; &amp; &lt;script&gt;');
    expect(planted).not.toContain('<b>x</b>');
  });
});

describe('the Engineer\'s notice on SCR-05 (12944 section 4)', () => {
  const markup = renderToStaticMarkup(createElement(EngineerIgnoredNotice, { ignored: IGNORED }));

  it('has its own words, not the notice of SCR-06: who, when and the remarks, then what the Engineer can and cannot do', () => {
    expect(markup).toContain('role="status"');
    expect(markup).toContain('This task was ignored on 05 Nov 2026, 12:05 IST by Kiran Bose.');
    expect(engineerNoticeTitle('05 Nov 2026, 12:05 IST', 'Kiran Bose')).toBe('This task was ignored on 05 Nov 2026, 12:05 IST by Kiran Bose.');
    expect(markup).toContain('You can read everything here, but nothing can be changed. A Lead or Admin can restore it, and it then comes back to your tasks with the status it had.');
    expect(markup).toContain('Not taken forward.\nThe customer chose another supplier.');
  });

  it('has no Restore, no button at all, no script, and none of the Lead\'s words (Restore, download, the status underneath)', () => {
    expect(markup).not.toMatch(/<button|<script|Restore|download|marked as quoted|when it was ignored/);
  });

  it('draws the remarks as a text node: <b>x</b> shows as typed', () => {
    const planted = renderToStaticMarkup(createElement(EngineerIgnoredNotice, { ignored: { ...IGNORED, remarks: '<b>x</b>' } }));
    expect(planted).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(planted).not.toContain('<b>x</b>');
  });
});
