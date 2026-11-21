import { describe, expect, it } from 'vitest';

import { overdueBy } from '@/lib/tasks/overdue';
import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { type DailyDigestMessage, type DailyDigestTask, renderDailyDigest } from '@/server/mail/templates/daily-digest';

/**
 * STORY-09.05 AC-4 (SCR-22, "Daily digest"): the message is built from a fixed DTO by a pure function, as HTML and as plain text with the same lines. It is a table sorted by deadline, oldest
 * first (task code, title, assigner, deadline in IST, "Overdue by" from `overdueBy(deadline, now)`, a link per task), with one "Open my tasks" link as a full address. User text is
 * HTML-escaped and nothing but the DTO's fields reaches the message. Every name and path is invented.
 */

const NOW = new Date('2026-11-20T05:30:00.000Z');
const HOUR = 60 * 60 * 1000;
const ORIGIN = 'https://portal.example.com';

const task = (overrides: Partial<DailyDigestTask> = {}): DailyDigestTask => ({
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  assignerName: 'Invented Boss',
  deadlineAt: new Date(NOW.getTime() - 5 * HOUR),
  taskLink: `${ORIGIN}/estimates/Q-2026-0042`,
  ...overrides,
});

const dto = (tasks: ReadonlyArray<DailyDigestTask> = [task()], overrides: Partial<DailyDigestMessage> = {}): DailyDigestMessage => ({
  tasks,
  now: NOW,
  myTasksLink: `${ORIGIN}/queue?tab=overdue`,
  ...overrides,
});

describe('AC-4: the words of the message, in HTML and in plain text', () => {
  it('has the subject with the IST date, the count at the time of the run, a row per task and the "Open my tasks" link, in both bodies', () => {
    const { subject, html, text } = renderDailyDigest(dto());
    expect(subject).toBe('Your overdue tasks, 20 Nov 2026');
    const lines = [
      'You have 1 overdue task as of 11:00 IST today.',
      'Q-2026-0042',
      'Hopper cover',
      'Invented Boss',
      '20 Nov 2026, 06:00 IST',
      '5 h',
      `${ORIGIN}/estimates/Q-2026-0042`,
      'Open my tasks',
      `${ORIGIN}/queue?tab=overdue`,
    ];
    for (const words of lines) {
      expect(html, `html: ${words}`).toContain(words);
      expect(text, `text: ${words}`).toContain(words);
    }
    expect(text).not.toMatch(/<[a-z]/i);
    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
  });

  it('says "tasks" for more than one and "task" for one', () => {
    expect(renderDailyDigest(dto([task(), task({ code: 'Q-2026-0043' })])).text).toContain('You have 2 overdue tasks as of 11:00 IST today.');
    expect(renderDailyDigest(dto()).text).toContain('You have 1 overdue task as of');
  });

  it('names the time of the run, so a catch-up at 14:00 says 14:00', () => {
    const now = new Date('2026-11-20T08:30:00.000Z');
    const { text } = renderDailyDigest(dto([task({ deadlineAt: new Date(now.getTime() - HOUR) })], { now }));
    expect(text).toContain('as of 14:00 IST today.');
  });

  it('sorts the rows by deadline, oldest first, and by code when two deadlines are the same, whatever order the caller gives', () => {
    const oldest = task({ code: 'Q-OLDEST', deadlineAt: new Date(NOW.getTime() - 50 * HOUR) });
    const middleA = task({ code: 'Q-MIDDLE-A', deadlineAt: new Date(NOW.getTime() - 10 * HOUR) });
    const middleB = task({ code: 'Q-MIDDLE-B', deadlineAt: new Date(NOW.getTime() - 10 * HOUR) });
    const newest = task({ code: 'Q-NEWEST', deadlineAt: new Date(NOW.getTime() - HOUR) });
    for (const shuffled of [[newest, middleB, oldest, middleA], [oldest, middleA, middleB, newest], [middleA, newest, middleB, oldest]]) {
      const { html, text } = renderDailyDigest(dto(shuffled));
      for (const body of [html, text]) {
        const positions = ['Q-OLDEST', 'Q-MIDDLE-A', 'Q-MIDDLE-B', 'Q-NEWEST'].map((code) => body.indexOf(`${code}`));
        expect(positions, body === html ? 'html' : 'text').toEqual([...positions].sort((a, b) => a - b));
        expect(positions.every((position) => position >= 0)).toBe(true);
      }
    }
  });

  it('"Overdue by" is the queue\'s own wording, from overdueBy(deadline, now), for each row', () => {
    for (const lateMs of [1, 59_000, 60_000, 90 * 60_000, 26 * HOUR]) {
      const deadlineAt = new Date(NOW.getTime() - lateMs);
      const expected = overdueBy(deadlineAt, NOW);
      expect(expected).not.toBeNull();
      expect(renderDailyDigest(dto([task({ deadlineAt })])).text).toContain(`| ${expected ?? ''} |`);
    }
  });

  it('writes a task with no title as a dash, and keeps the row', () => {
    const { text } = renderDailyDigest(dto([task({ title: null })]));
    expect(text).toContain('Q-2026-0042 | - | Invented Boss |');
  });

  it('writes a 23:30 IST deadline as 23:30 IST on its own day, not the UTC day (NFR-015)', () => {
    const { text } = renderDailyDigest(dto([task({ deadlineAt: new Date('2026-11-19T18:00:00.000Z') })]));
    expect(text).toContain('19 Nov 2026, 23:30 IST');
  });

  it('escapes user text in HTML: a title or a name with markup cannot change the message', () => {
    const { html } = renderDailyDigest(dto([task({ title: '<script>alert(1)</script>', assignerName: 'A & "B" <i>c</i>' })]));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<i>c</i>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A &amp; &quot;B&quot; &lt;i&gt;c&lt;/i&gt;');
  });

  it('reads only its own fields: a cost, a rate or a customer riding along on a task is never written', () => {
    const planted = { ...task(), totalCost: 'PLANTED-COST-123', ratePerHour: 'PLANTED-RATE-456', customerName: 'PLANTED-CUSTOMER-789' };
    const { subject, html, text } = renderDailyDigest({ ...dto([planted]), customerName: 'PLANTED-CUSTOMER-789' } as DailyDigestMessage);
    for (const body of [subject, html, text]) expect(body).not.toMatch(/PLANTED/);
  });

  it('has no row for a task that is not overdue: that is a mistake in the code', () => {
    expect(() => renderDailyDigest(dto([task({ deadlineAt: NOW })]))).toThrow(RangeError);
    expect(() => renderDailyDigest(dto([task({ deadlineAt: new Date(NOW.getTime() + 1) })]))).toThrow(RangeError);
  });

  it('has no message for an Engineer with no overdue task: an empty list is a mistake in the code', () => {
    expect(() => renderDailyDigest(dto([]))).toThrow(RangeError);
  });
});
