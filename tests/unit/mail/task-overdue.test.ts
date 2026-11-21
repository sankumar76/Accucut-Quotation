import { describe, expect, it } from 'vitest';

import { overdueBy } from '@/lib/tasks/overdue';
import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { renderTaskOverdue, type TaskOverdueMessage } from '@/server/mail/templates/task-overdue';

/**
 * STORY-09.04 AC-7 (SCR-22, "Task overdue"): the message is built from a fixed DTO by a pure function, as HTML and as plain text with the same lines. It says "This task is now
 * overdue. It was due on <deadline in IST>.", shows the code, the title, the folder (path and link), the assigner's name and "Overdue by" from `overdueBy(deadline, now)`, and has the
 * "Open the task" link as a full address. User text is HTML-escaped, a 23:30 IST deadline reads 23:30 IST, and nothing but the DTO's fields reaches the message. Every name and path is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ 123';
const FOLDER_URL = 'file:////invented-server/invented-share/RFQ%20123';
const DEADLINE = new Date('2026-11-06T11:30:00.000Z');
const FIVE_HOURS = 5 * 60 * 60 * 1000;

const dto = (overrides: Partial<TaskOverdueMessage> = {}): TaskOverdueMessage => ({
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  assignerName: 'Invented Boss',
  folderPath: PATH,
  folderUrl: FOLDER_URL,
  deadlineAt: DEADLINE,
  now: new Date(DEADLINE.getTime() + FIVE_HOURS),
  taskLink: 'https://portal.example.com/estimates/Q-2026-0042',
  ...overrides,
});

describe('AC-7: the words of the message, in HTML and in plain text', () => {
  it('says the SCR-22 sentence and gives the same lines in both bodies', () => {
    const { subject, html, text } = renderTaskOverdue(dto());
    expect(subject).toBe('Task overdue: Q-2026-0042');
    const lines = [
      'This task is now overdue. It was due on 06 Nov 2026, 17:00 IST.',
      'Q-2026-0042',
      'Hopper cover',
      'Invented Boss',
      PATH,
      FOLDER_URL,
      'Overdue by: 5 h',
      'Open the task',
      'https://portal.example.com/estimates/Q-2026-0042',
    ];
    for (const words of lines) {
      expect(html, `html: ${words}`).toContain(words);
      expect(text, `text: ${words}`).toContain(words);
    }
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('"Overdue by" is the queue\'s own wording, from overdueBy(deadline, now)', () => {
    for (const lateMs of [1, 59_000, 60_000, 90 * 60_000, 26 * 3_600_000]) {
      const now = new Date(DEADLINE.getTime() + lateMs);
      const expected = overdueBy(DEADLINE, now);
      expect(expected).not.toBeNull();
      expect(renderTaskOverdue(dto({ now })).text).toContain(`Overdue by: ${expected ?? ''}`);
    }
  });

  it('refuses a task that is not overdue yet: the caller judged wrongly, so nothing is built', () => {
    expect(() => renderTaskOverdue(dto({ now: DEADLINE }))).toThrow(RangeError);
    expect(() => renderTaskOverdue(dto({ now: new Date(DEADLINE.getTime() - 1) }))).toThrow(RangeError);
  });

  it('reads a 23:30 IST deadline as 23:30 IST on the same day, though it is 18:00 UTC', () => {
    const deadlineAt = new Date('2026-11-06T18:00:00.000Z');
    const { html, text } = renderTaskOverdue(dto({ deadlineAt, now: new Date(deadlineAt.getTime() + 60_000) }));
    expect(text).toContain('It was due on 06 Nov 2026, 23:30 IST.');
    expect(html).toContain('It was due on 06 Nov 2026, 23:30 IST.');
  });

  it('leaves the title line out when the task has none, and the folder link out when the path has none, with the advice for a blocked link only when there is a link', () => {
    const noTitle = renderTaskOverdue(dto({ title: null })).text;
    expect(noTitle).not.toContain('Title:');
    const noLink = renderTaskOverdue(dto({ folderUrl: null }));
    expect(noLink.text).toContain(PATH);
    expect(noLink.text).not.toContain('Folder link:');
    expect(noLink.text).not.toMatch(/copy the path/i);
    expect(renderTaskOverdue(dto()).text).toMatch(/copy the path/i);
  });

  it('has the logo by content ID and the portal footer, from the shared layout', () => {
    const { html, text } = renderTaskOverdue(dto());
    expect(html).toContain(`cid:${LOGO_CONTENT_ID}`);
    expect(text).toContain('This is an automated message');
  });
});

describe('AC-7: user text is escaped, and only the DTO reaches the message', () => {
  it('shows markup in a title, a name or a path as text in the HTML body and unchanged in the plain-text one', () => {
    const hostile = '<script>alert("x")</script> & <b>bold</b>';
    const { html, text } = renderTaskOverdue(dto({ title: hostile, assignerName: hostile, folderPath: `\\\\server\\share\\${hostile}` }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;');
    expect(text).toContain(hostile);
  });

  it('reads each field by name: a cost, a rate, a formula, a customer or a price that rides along on the object is never in the message', () => {
    const planted = { ...dto(), cost: 'PLANTED-COST-7731', rate: 'PLANTED-RATE-7731', formula: 'PLANTED-FORMULA-7731', customer: 'PLANTED-CUSTOMER-7731', price: 'PLANTED-PRICE-7731' };
    const { subject, html, text } = renderTaskOverdue(planted);
    for (const secret of ['PLANTED-COST-7731', 'PLANTED-RATE-7731', 'PLANTED-FORMULA-7731', 'PLANTED-CUSTOMER-7731', 'PLANTED-PRICE-7731']) {
      expect(`${subject}\n${html}\n${text}`).not.toContain(secret);
    }
  });

  it('refuses a link that is not a full http or https address', () => {
    expect(() => renderTaskOverdue(dto({ taskLink: 'javascript:alert(1)' }))).toThrow(RangeError);
    expect(() => renderTaskOverdue(dto({ taskLink: '/estimates/Q-2026-0042' }))).toThrow(RangeError);
  });
});
