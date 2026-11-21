import { describe, expect, it } from 'vitest';

import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { renderTaskAssigned, type TaskAssignedMessage } from '@/server/mail/templates/task-assigned';

/**
 * STORY-09.03 AC-2, AC-3 and AC-8 (SCR-22, "Task assigned"): the message is built from a fixed DTO by a pure function, as HTML and as plain text with the same lines. A title or notes
 * that hold markup are text, the deadline is read in IST, the folder is shown as a path and as the `file:` link with the advice for a blocked link, and the link to the task is a full
 * address. Nothing but the DTO's fields reaches the message. Every name, path and value is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ 123';
const FOLDER_URL = 'file:////invented-server/invented-share/RFQ%20123';

const dto = (overrides: Partial<TaskAssignedMessage> = {}): TaskAssignedMessage => ({
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  notes: 'Sheet-metal parts only.',
  assignerName: 'Invented Boss',
  folderPath: PATH,
  folderUrl: FOLDER_URL,
  deadlineAt: new Date('2026-11-06T11:30:00.000Z'),
  taskLink: 'https://portal.example.com/estimates/Q-2026-0042',
  ...overrides,
});

describe('AC-2: the words of the message, in HTML and in plain text', () => {
  it('gives the same lines in both bodies: code, title, notes, who assigned it, the folder as a path and a link, the deadline in IST, and "Open the task"', () => {
    const { subject, html, text } = renderTaskAssigned(dto());
    expect(subject).toBe('Task assigned: Q-2026-0042');
    for (const words of [
      'Q-2026-0042',
      'Hopper cover',
      'Sheet-metal parts only.',
      'Invented Boss',
      PATH,
      FOLDER_URL,
      '06 Nov 2026, 17:00 IST',
      'Open the task',
      'https://portal.example.com/estimates/Q-2026-0042',
    ]) {
      expect(html, `html: ${words}`).toContain(words.replaceAll('&', '&amp;'));
      expect(text, `text: ${words}`).toContain(words);
    }
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('advises copying the path when the link is blocked, in both bodies', () => {
    const { html, text } = renderTaskAssigned(dto());
    expect(html).toMatch(/copy the path/i);
    expect(text).toMatch(/copy the path/i);
  });

  it('has no link line, and no advice, for a stored path that has no file link', () => {
    const { html, text } = renderTaskAssigned(dto({ folderUrl: null }));
    expect(text).toContain(PATH);
    expect(text).not.toContain('file:');
    expect(html).not.toContain('file:');
    expect(text).not.toMatch(/copy the path/i);
  });

  it('leaves out the title and the notes when none were given', () => {
    const { text } = renderTaskAssigned(dto({ title: null, notes: null }));
    expect(text).not.toMatch(/Title:/);
    expect(text).not.toMatch(/Notes:/);
    expect(text).toContain('Q-2026-0042');
  });

  it('uses the shared layout: the inline logo by content ID, and a subject of one line', () => {
    const { subject, html } = renderTaskAssigned(dto({ title: 'Line one\r\nBcc: someone@example.com' }));
    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it('keeps the line breaks of the notes', () => {
    const { html, text } = renderTaskAssigned(dto({ notes: 'First line\nSecond line' }));
    expect(text).toContain('First line\nSecond line');
    expect(html).toContain('First line<br>Second line');
  });
});

describe('AC-2: what a person typed is text, never markup', () => {
  it('escapes a <script> in the title and the notes in HTML, and leaves it as written in plain text', () => {
    const hostile = '<script>alert(1)</script>';
    const { html, text } = renderTaskAssigned(dto({ title: hostile, notes: `${hostile} & "more"`, assignerName: '<b>Boss</b>' }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Boss</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Boss&lt;/b&gt;');
    expect(text).toContain(hostile);
  });

  it('refuses a link to the task that is not an http or https address', () => {
    expect(() => renderTaskAssigned(dto({ taskLink: 'javascript:alert(1)' }))).toThrow(RangeError);
  });
});

describe('AC-8 (NFR-015): the deadline is the IST time, not the UTC date', () => {
  it('reads 23:30 IST on that date for 18:00 UTC', () => {
    const { html, text } = renderTaskAssigned(dto({ deadlineAt: new Date('2026-11-06T18:00:00.000Z') }));
    expect(text).toContain('06 Nov 2026, 23:30 IST');
    expect(html).toContain('06 Nov 2026, 23:30 IST');
  });

  it('reads the next IST day for 20:00 UTC', () => {
    expect(renderTaskAssigned(dto({ deadlineAt: new Date('2026-11-06T20:00:00.000Z') })).text).toContain('07 Nov 2026, 01:30 IST');
  });
});

describe('AC-3 (NFR-002): the message is built from the DTO and nothing else', () => {
  const CANARY = '7171.43';
  const CUSTOMER = 'Invented Customer Canary Ltd';

  it('drops a cost, a rate, a formula, a customer or a price that rides along on the object: no canary value appears in either body or the subject', () => {
    const smuggled = { ...dto(), totalCost: CANARY, machiningRate: CANARY, formula: `a*${CANARY}`, customerName: CUSTOMER, approvedPrice: CANARY };
    const { subject, html, text } = renderTaskAssigned(smuggled);
    for (const part of [subject, html, text]) {
      expect(part).not.toContain(CANARY);
      expect(part).not.toContain(CUSTOMER);
    }
  });
});
