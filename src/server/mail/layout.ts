/**
 * The shared wrapper of every e-mail the portal sends (STORY-09.01; architecture section 4.7; SCR-22 is a template reference, not a route).
 *
 * A template of a later story (assignment, overdue, digest, backup missed, password reset) calls `renderMail` with its words and gets the HTML body and its plain-text twin, so every
 * message has both (SCR-22). The logo is attached inline by content ID (`send.ts` adds the attachment when the HTML names it), so no mail client fetches anything from the portal.
 *
 * Everything a caller passes is plain text and is escaped here, so a task title or a person's name that holds markup cannot change the message. A link must be a full http(s)
 * address (architecture section 4.7 builds them from `APP_ORIGIN`); anything else is refused. The content has no field that could hold a cost, a rate or a formula: it is
 * strings, and the modules that call it are classed by `tests/security/engineer-import-rule.test.ts` (TB-4).
 */

/** The content ID the HTML refers to the logo by (`<img src="cid:...">`). */
export const LOGO_CONTENT_ID = 'accucut-logo@portal.invalid';

export const PORTAL_NAME = 'Accucut Quotation Portal';

export interface MailAction {
  /** The words of the button and of the plain-text line, for example "Open the task". */
  readonly label: string;
  /** A full http or https address. */
  readonly url: string;
}

export interface MailContent {
  readonly heading: string;
  /** Plain-text paragraphs, in order. */
  readonly paragraphs: ReadonlyArray<string>;
  readonly action?: MailAction;
}

export interface RenderedMail {
  readonly html: string;
  readonly text: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/** A link is shown only if it is a plain http(s) address: a `javascript:` or `data:` address in an e-mail is never right. */
function safeUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RangeError('A mail link must be a full address.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new RangeError('A mail link must be an http or https address.');
  return parsed.href;
}

const FOOTER = `${PORTAL_NAME}. This is an automated message; please do not reply.`;

export function renderMail(content: MailContent): RenderedMail {
  const action = content.action === undefined ? undefined : { label: content.action.label, url: safeUrl(content.action.url) };

  const paragraphsHtml = content.paragraphs.map((paragraph) => `<p style="margin:0 0 12px 0;">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`).join('');
  const actionHtml =
    action === undefined
      ? ''
      : `<p style="margin:16px 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;background:#1f2937;color:#ffffff;text-decoration:none;border-radius:4px;">${escapeHtml(action.label)}</a></p>` +
        `<p style="margin:0 0 12px 0;font-size:12px;color:#4b5563;">${escapeHtml(action.label)}: ${escapeHtml(action.url)}</p>`;

  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${escapeHtml(content.heading)}</title></head>` +
    '<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">' +
    '<div style="max-width:600px;margin:0 auto;padding:24px 16px;">' +
    `<div style="padding-bottom:16px;"><img src="cid:${LOGO_CONTENT_ID}" alt="${escapeHtml(PORTAL_NAME)}" height="48" style="display:block;height:48px;border:0;"></div>` +
    '<div style="background:#ffffff;padding:24px;border-radius:6px;">' +
    `<h1 style="margin:0 0 16px 0;font-size:18px;">${escapeHtml(content.heading)}</h1>` +
    paragraphsHtml +
    actionHtml +
    '</div>' +
    `<p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">${escapeHtml(FOOTER)}</p>` +
    '</div></body></html>';

  const textLines = [content.heading, '', ...content.paragraphs.flatMap((paragraph) => [paragraph, ''])];
  if (action !== undefined) textLines.push(`${action.label}: ${action.url}`, '');
  textLines.push('--', FOOTER);

  return { html, text: textLines.join('\n') };
}
