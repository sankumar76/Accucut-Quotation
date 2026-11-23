import { randomBytes } from 'node:crypto';

import { createTransport, type SendMailOptions } from 'nodemailer';
import { z } from 'zod';

import { createFixedClock } from '@/lib/time';
import { createMailTransport, type MailTransport } from '@/server/mail/transport';

/**
 * Where a test reads back what the portal "sent" (STORY-09.01 AC-9; test strategy section 4).
 *
 * Two backends behind one interface, so every mail test is written once:
 *   - Mailpit (the capturing mail server of `compose.dev.yml` and of CI's `verify` job): chosen when `MAILPIT_API_URL` and `MAILPIT_SMTP_PORT` are set. The message goes through the real
 *     `none` mode of `createMailTransport` over SMTP, and is read back through Mailpit's HTTP API (search, read).
 *   - An in-process stub (Nodemailer's own JSON transport, no network): used when they are not set, so a developer without Docker still runs the whole suite. The message is built and
 *     encoded by Nodemailer as for a real send; only the wire is missing.
 *
 * A Mailpit instance is shared by every test file of a run, and files run in parallel, so a capture only ever reads its own messages (DEF-064, DL-305, DL-325):
 *   - Every message sent through `transport` carries one `X-Tags` value that is new to this capture (Mailpit turns it into a tag), and `list()` asks Mailpit for that tag alone.
 *     It never lists, nor fetches, a message of another file, so another file's messages being removed while this one reads cannot fail the read.
 *   - Nothing deletes from the inbox. There is no "clear": a delete of the whole inbox, or of another file's messages by ID, made a read of the shared inbox answer 404.
 *   - Mailpit's own limit (500 messages by default, the oldest pruned first) can only reach a message of this capture when 500 newer messages arrive while the file runs. A 404 is
 *     not skipped: it would hide a message that really is gone, which is the very thing a test asserts on.
 * A test still matches by a recipient, subject or code of its own, because a file's messages are shared by its tests. Addresses are invented (`example.com`), and nothing here
 * holds a secret.
 */

export interface CapturedMail {
  readonly from: { readonly name: string; readonly address: string };
  readonly to: ReadonlyArray<string>;
  readonly cc: ReadonlyArray<string>;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /** The content IDs of the inline attachments (the logo). */
  readonly inlineContentIds: ReadonlyArray<string>;
}

export interface MailCapture {
  readonly backend: 'mailpit' | 'stub';
  /** What the code under test sends through. */
  readonly transport: MailTransport;
  /** Every message sent through this capture's `transport` so far, oldest first. Messages of other captures (other files, earlier runs) are never read. */
  list(): Promise<ReadonlyArray<CapturedMail>>;
  /** Stops anything the capture started. */
  close(): Promise<void>;
}

const addressSchema = z.object({ Name: z.string(), Address: z.string() });
// `messages_count` is the number of messages that match the search and `messages` is the page, so a page shorter than the count (a silent loss) can be told.
const summaryListSchema = z.object({ messages_count: z.number().int().nonnegative(), messages: z.array(z.object({ ID: z.string() })) });
const messageSchema = z.object({
  From: addressSchema,
  To: z.array(addressSchema).nullable(),
  Cc: z.array(addressSchema).nullable(),
  Subject: z.string(),
  HTML: z.string(),
  Text: z.string(),
  Inline: z.array(z.object({ ContentID: z.string() })).nullable(),
});

const jsonAddressSchema = z.object({ name: z.string(), address: z.string() });
const jsonMessageSchema = z.object({
  from: jsonAddressSchema,
  to: z.array(jsonAddressSchema).nullish(),
  cc: z.array(jsonAddressSchema).nullish(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  attachments: z.array(z.object({ cid: z.string().optional() })).nullish(),
});

/** The most messages one read asks Mailpit for. A capture holds one file's messages, far fewer than this; `list()` throws if a page ever falls short of the count. */
const PAGE_LIMIT = 500;

/** One tag per capture, random, so it never matches another file's, another run's, or one a person set by hand in a long-lived local Mailpit. */
function newTag(): string {
  return `capture-${randomBytes(8).toString('hex')}`;
}

/** The message with the `X-Tags` header added, whichever form (object or list) Nodemailer's `headers` option is in. */
function withTag(message: SendMailOptions, tag: string): SendMailOptions {
  const headers = message.headers;
  if (Array.isArray(headers)) return { ...message, headers: [...headers, { key: 'X-Tags', value: tag }] };
  return { ...message, headers: { ...headers, 'X-Tags': tag } };
}

async function mailpitJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${init?.method ?? 'GET'} ${new URL(url).pathname}`);
  return response.json();
}

function openMailpit(apiUrl: string, smtpPort: number): MailCapture {
  const base = apiUrl.replace(/\/+$/, '');
  const tag = newTag();
  const smtp = createMailTransport({ SMTP_AUTH_MODE: 'none', SMTP_HOST: '127.0.0.1', SMTP_PORT: smtpPort }, { clock: createFixedClock(new Date()) });
  return {
    backend: 'mailpit',
    transport: { sendMail: (message) => smtp.sendMail(withTag(message, tag)) },
    async list() {
      // This capture's tag only. Mailpit lists newest first; the interface says oldest first.
      const search = `${base}/api/v1/search?query=${encodeURIComponent(`tag:${tag}`)}&limit=${PAGE_LIMIT}`;
      const { messages, messages_count: matching } = summaryListSchema.parse(await mailpitJson(search));
      if (messages.length < matching) throw new Error(`Mailpit found ${matching} messages for this capture but returned ${messages.length}.`);
      const captured: CapturedMail[] = [];
      for (const { ID } of [...messages].reverse()) {
        const message = messageSchema.parse(await mailpitJson(`${base}/api/v1/message/${encodeURIComponent(ID)}`));
        captured.push({
          from: { name: message.From.Name, address: message.From.Address },
          to: (message.To ?? []).map((recipient) => recipient.Address),
          cc: (message.Cc ?? []).map((recipient) => recipient.Address),
          subject: message.Subject,
          html: message.HTML,
          text: message.Text,
          inlineContentIds: (message.Inline ?? []).map((part) => part.ContentID),
        });
      }
      return captured;
    },
    close: () => Promise.resolve(),
  };
}

function openStub(): MailCapture {
  const sent: CapturedMail[] = [];
  const json = createTransport({ jsonTransport: true });
  const transport: MailTransport = {
    async sendMail(message) {
      const info = await json.sendMail(message);
      const parsed = jsonMessageSchema.parse(JSON.parse(String(info.message)));
      sent.push({
        from: parsed.from,
        to: (parsed.to ?? []).map((recipient) => recipient.address),
        cc: (parsed.cc ?? []).map((recipient) => recipient.address),
        subject: parsed.subject,
        html: parsed.html,
        text: parsed.text,
        inlineContentIds: (parsed.attachments ?? []).flatMap((attachment) => attachment.cid ?? []),
      });
      return info;
    },
  };
  return {
    backend: 'stub',
    transport,
    list: () => Promise.resolve([...sent]),
    close: () => Promise.resolve(),
  };
}

/** Mailpit when the run provides one, the in-process stub otherwise. */
export function openMailCapture(): MailCapture {
  const apiUrl = process.env['MAILPIT_API_URL'];
  const smtpPort = Number(process.env['MAILPIT_SMTP_PORT']);
  if (apiUrl !== undefined && apiUrl !== '' && Number.isInteger(smtpPort) && smtpPort > 0) return openMailpit(apiUrl, smtpPort);
  return openStub();
}
