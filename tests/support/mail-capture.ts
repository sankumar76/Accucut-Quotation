import { createTransport } from 'nodemailer';
import { z } from 'zod';

import { createFixedClock } from '@/lib/time';
import { createMailTransport, type MailTransport } from '@/server/mail/transport';

/**
 * Where a test reads back what the portal "sent" (STORY-09.01 AC-9; test strategy section 4).
 *
 * Two backends behind one interface, so every mail test is written once:
 *   - Mailpit (the capturing mail server of `compose.dev.yml` and of CI's `verify` job): chosen when `MAILPIT_API_URL` and `MAILPIT_SMTP_PORT` are set. The message goes through the real
 *     `none` mode of `createMailTransport` over SMTP, and is read back through Mailpit's HTTP API (list, read, clear).
 *   - An in-process stub (Nodemailer's own JSON transport, no network): used when they are not set, so a developer without Docker still runs the whole suite. The message is built and
 *     encoded by Nodemailer as for a real send; only the wire is missing.
 *
 * Messages are matched by their recipient or subject (a test uses values of its own), because a Mailpit instance is shared by every test file of a run. Addresses are invented
 * (`example.com`), and nothing here holds a secret.
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
  /** Every message captured so far, oldest first. */
  list(): Promise<ReadonlyArray<CapturedMail>>;
  /** Forgets every message. Call it once, before a test file's first send: other files may share a Mailpit. */
  clear(): Promise<void>;
  /** Stops anything the capture started. */
  close(): Promise<void>;
}

const addressSchema = z.object({ Name: z.string(), Address: z.string() });
const summaryListSchema = z.object({ messages: z.array(z.object({ ID: z.string() })) });
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

async function mailpitJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${init?.method ?? 'GET'} ${new URL(url).pathname}`);
  return response.json();
}

function openMailpit(apiUrl: string, smtpPort: number): MailCapture {
  const base = apiUrl.replace(/\/+$/, '');
  return {
    backend: 'mailpit',
    transport: createMailTransport({ SMTP_AUTH_MODE: 'none', SMTP_HOST: '127.0.0.1', SMTP_PORT: smtpPort }, { clock: createFixedClock(new Date()) }),
    async list() {
      // Mailpit lists newest first; the interface says oldest first.
      const { messages } = summaryListSchema.parse(await mailpitJson(`${base}/api/v1/messages?limit=500`));
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
    async clear() {
      // Mailpit answers a delete with the plain text "ok", not JSON.
      const response = await fetch(`${base}/api/v1/messages`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Mailpit answered ${response.status} for DELETE /api/v1/messages`);
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
    clear: () => {
      sent.length = 0;
      return Promise.resolve();
    },
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
