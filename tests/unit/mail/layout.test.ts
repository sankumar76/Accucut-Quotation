import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { escapeHtml, LOGO_CONTENT_ID, PORTAL_NAME, renderMail } from '@/server/mail/layout';
import { LOGO_BYTES } from '@/server/mail/logo';

/**
 * STORY-09.01 (architecture section 4.7, SCR-22): the shared wrapper gives every message an HTML body and a plain-text twin with the same words, the logo by content ID, and escapes
 * what a caller passes; a link is a full http(s) address. The embedded logo is the file in `public`.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('renderMail', () => {
  const content = {
    heading: 'A new task',
    paragraphs: ['You have a new task.', 'Deadline: 20 Nov 2026, 17:00 IST'],
    action: { label: 'Open the task', url: 'https://portal.example.com/tasks/abc' },
  };

  it('gives an HTML body and a plain-text twin with the same words', () => {
    const { html, text } = renderMail(content);
    for (const words of ['A new task', 'You have a new task.', 'Deadline: 20 Nov 2026, 17:00 IST', 'Open the task', 'https://portal.example.com/tasks/abc', PORTAL_NAME]) {
      expect(html, `html: ${words}`).toContain(words);
      expect(text, `text: ${words}`).toContain(words);
    }
    expect(text).not.toMatch(/<[a-z]/i);
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('refers to the logo by content ID, so no mail client fetches it from the portal', () => {
    const { html } = renderMail(content);
    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
    expect(html).not.toMatch(/src="https?:/);
  });

  it('escapes what a caller passes: markup in a title or a name cannot change the message', () => {
    const { html, text } = renderMail({ heading: '<script>alert(1)</script>', paragraphs: ['Tom & "Jerry" <b>bold</b>'] });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Tom &amp; &quot;Jerry&quot; &lt;b&gt;bold&lt;/b&gt;');
    expect(text).toContain('Tom & "Jerry" <b>bold</b>');
  });

  it('escapes a link too, so a quote in it cannot leave the attribute', () => {
    const { html } = renderMail({ heading: 'H', paragraphs: ['P'], action: { label: 'Go', url: 'https://portal.example.com/a?x="1"&y=2' } });
    expect(html).not.toContain('"1"');
    expect(html).toContain('x=%221%22&amp;y=2');
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://portal.example.com/file', '/relative/path', 'portal.example.com'])('refuses the link %s', (url) => {
    expect(() => renderMail({ heading: 'H', paragraphs: ['P'], action: { label: 'Go', url } })).toThrow(RangeError);
  });

  it('works with no action', () => {
    const { html, text } = renderMail({ heading: 'H', paragraphs: ['P'] });
    expect(html).not.toContain('<a ');
    expect(text).toContain('P');
  });

  it('turns a line break in a paragraph into a break in the HTML', () => {
    expect(renderMail({ heading: 'H', paragraphs: ['one\ntwo'] }).html).toContain('one<br>two');
  });

  it('escapeHtml escapes the five characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('the embedded logo', () => {
  it('is exactly public/accucut-logo.jpg (a copy that drifted would put an old logo in every message)', () => {
    expect(LOGO_BYTES.equals(readFileSync(`${ROOT}public/accucut-logo.jpg`))).toBe(true);
    expect(LOGO_BYTES.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  });
});
