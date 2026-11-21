import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createMailer } from '@/server/mail/send';
import type { OutboxMessage } from '@/server/repositories/email-outbox-repository';

/**
 * STORY-09.01 AC-10 (NFR-002, TB-4): the mail module and the job that sends from the outbox import no cost, rate, formula or calculation module, and what goes through them is a
 * fixed shape of strings. The test classes every file: a new file in `src/server/mail`, `src/lib/mail` or `src/server/jobs` fails here until someone decides what it may import,
 * the same rule as the other lists of `engineer-import-rule.test.ts`. The Engineer-view rule itself (a view may not import the outbox repository) is that file's: the repository
 * is on its blocked list.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const MAIL_FILES = {
  'src/server/mail': ['layout.ts', 'logo.ts', 'mail-service.ts', 'microsoft-token.ts', 'send.ts', 'transport.ts'],
  'src/lib/mail': ['codes.ts', 'events.ts'],
  // STORY-09.03, 09.04 and 09.05: the message of each alert is a pure function from a fixed DTO of plain strings (no cost field), on top of the shared layout.
  'src/server/mail/templates': ['daily-digest.ts', 'task-assigned.ts', 'task-overdue.ts'],
} as const;

const JOB_FILE = 'src/server/jobs/outbox-send.ts';
/** The job that queues the overdue e-mail (STORY-09.04): it builds the message from plain fields and takes its store by parameter, as `outbox-send` does. */
const SCAN_FILE = 'src/server/jobs/overdue-scan.ts';
/** The job that queues the daily digest (STORY-09.05): the same, from plain fields and a store it is given. */
const DIGEST_FILE = 'src/server/jobs/daily-digest.ts';

/** The only things these files may import, by exact specifier. Nothing that holds a cost, a rate, a formula or a calculation is on it, and nothing may be added without a review. */
const ALLOWED_SPECIFIER = [
  /^nodemailer$/,
  /^node-cron$/,
  /^zod$/,
  /^\.\/(layout|logo|mail-service|microsoft-token|send|transport)$/,
  // STORY-10.09a: the one job wrapper, which imports nothing itself (engineer-import-rule.test.ts classes it).
  /^\.\/run-job$/,
  /^\.\.\/\.\.\/lib\/(env|time)$/,
  // From `src/server/mail/templates/`: the shared layout above it, `formatIst` from the time module and the overdue rule of a task (STORY-09.04), three levels up.
  /^\.\.\/layout$/,
  /^\.\.\/\.\.\/\.\.\/lib\/(time|tasks\/overdue)$/,
  // From `src/server/jobs/overdue-scan.ts` and `daily-digest.ts` (STORY-09.04, 09.05): the plain, pure rules of a task, and the overdue and digest templates.
  /^\.\.\/\.\.\/lib\/tasks\/(folder-path|overdue|task-link)$/,
  /^\.\.\/mail\/templates\/(task-overdue|daily-digest)$/,
  /^\.\.\/\.\.\/lib\/mail\/(codes|events)$/,
  /^\.\.\/mail\/send$/,
  /^\.\.\/repositories\/(email-outbox-repository|transaction)$/,
];

/** Words of a module path that mean cost, rate, formula or calculation data (or the code that reads it). */
const COST_MODULE_WORDS = /formula|calculat|estimate|approval|export|config|exchange|material|customer|master|treatment|\brates?\b|cost|price|audit|task-repository/i;

function specifiersOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((match) => match[1] ?? '');
}

const filesOf = (directory: string): string[] => readdirSync(join(ROOT, directory)).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));

describe('every file of the mail module is classed (AC-10)', () => {
  it.each(Object.entries(MAIL_FILES))('every file in %s is on the list; a new file fails here until someone decides', (directory, listed) => {
    expect(filesOf(directory).sort()).toEqual([...listed].sort());
  });

  it('the job outbox-send is where the jobs test classes it (engineer-import-rule.test.ts), and exists', () => {
    expect(filesOf('src/server/jobs')).toContain('outbox-send.ts');
  });
});

const GUARDED = [...Object.entries(MAIL_FILES).flatMap(([directory, names]) => names.map((name) => `${directory}/${name}`)), JOB_FILE, SCAN_FILE, DIGEST_FILE];

describe('the mail module imports no cost, rate, formula or calculation module (AC-10)', () => {
  it.each(GUARDED)('%s imports only what is on the allowed list', (path) => {
    const specifiers = specifiersOf(readFileSync(join(ROOT, path), 'utf8'));
    for (const specifier of specifiers) {
      expect(ALLOWED_SPECIFIER.some((pattern) => pattern.test(specifier)), `${path} imports ${specifier}`).toBe(true);
      expect(specifier, `${path} imports ${specifier}`).not.toMatch(COST_MODULE_WORDS);
    }
  });

  it('negative control: the word list does catch a cost module, a formula module and a calculation repository', () => {
    for (const bad of ['../../lib/formula/evaluate', '../services/calculation-service', '../repositories/calculation-repository', '../services/cost-details-service', '../repositories/material-repository']) {
      expect(bad).toMatch(COST_MODULE_WORDS);
      expect(ALLOWED_SPECIFIER.some((pattern) => pattern.test(bad))).toBe(false);
    }
  });

  it.each([JOB_FILE, SCAN_FILE, DIGEST_FILE])('the job %s takes the data layer by parameter: it names no repository module at all', (job) => {
    const specifiers = specifiersOf(readFileSync(join(ROOT, job), 'utf8'));
    expect(specifiers.filter((specifier) => /repositories|services|composition|generated|@prisma|\bpg\b/.test(specifier))).toEqual([]);
  });
});

describe('nothing else sends mail (AC-8)', () => {
  function sourceFiles(directory: string): string[] {
    return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
  }

  it('only src/server/mail/transport.ts opens the mail transport, and only src/server/mail/send.ts imports a type of nodemailer besides it', () => {
    const importers = sourceFiles('src')
      .filter((path) => !path.startsWith('src/generated'))
      .filter((path) => specifiersOf(readFileSync(join(ROOT, path), 'utf8')).includes('nodemailer'))
      .sort();
    expect(importers).toEqual(['src/server/mail/send.ts', 'src/server/mail/transport.ts']);
    expect(readFileSync(join(ROOT, 'src/server/mail/send.ts'), 'utf8')).toMatch(/import type \{ SendMailOptions \} from 'nodemailer'/);
  });

  it('only the composition root and the worker build a mail transport', () => {
    const builders = sourceFiles('src')
      .filter((path) => /createMailTransport\(/.test(readFileSync(join(ROOT, path), 'utf8')))
      .sort();
    expect(builders).toEqual(['src/server/composition.ts', 'src/server/mail/transport.ts', 'src/worker/main.ts']);
  });
});

describe('the message is a fixed shape of strings (AC-10, TB-4)', () => {
  // `Record<keyof OutboxMessage, ...>` is complete or it does not compile: a field added to the message type has to be classed here, and no kind below can hold a number or a decimal.
  const SHAPE: Record<keyof OutboxMessage, 'string' | 'strings' | 'date'> = {
    idempotencyKey: 'string',
    event: 'string',
    toUserId: 'string',
    ccUserIds: 'strings',
    subject: 'string',
    bodyHtml: 'string',
    bodyText: 'string',
    sendBefore: 'date',
  };

  it('has no field that could carry a number: strings, a list of strings and one deadline', () => {
    expect(Object.values(SHAPE).every((kind) => kind === 'string' || kind === 'strings' || kind === 'date')).toBe(true);
    expect(Object.keys(SHAPE).sort()).toEqual(['bodyHtml', 'bodyText', 'ccUserIds', 'event', 'idempotencyKey', 'sendBefore', 'subject', 'toUserId']);
  });

  it('what reaches the transport is the same fixed set of fields, whatever the caller passes in the mail object', async () => {
    const CANARY = '9393.37';
    const sent: Array<Record<string, unknown>> = [];
    const mailer = createMailer({ sendMail: (message) => Promise.resolve(void sent.push({ ...message })) });
    // A caller that adds a field gets it dropped, not forwarded: the mailer names each field it sends.
    const mail = { to: 'engineer@example.com', cc: [], subject: 'S', html: '<p>H</p>', text: 'T', totalCost: CANARY };
    await mailer.send(mail, { name: 'Portal', mailbox: 'portal@example.com' });
    expect(Object.keys(sent[0] ?? {}).sort()).toEqual(['attachments', 'cc', 'from', 'html', 'subject', 'text', 'to']);
    expect(JSON.stringify(sent)).not.toContain(CANARY);
  });
});
