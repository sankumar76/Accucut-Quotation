import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ENV_VARIABLE_NAMES, SECRET_ENV_VARIABLE_NAMES } from '@/lib/env';
import { checkDisplayFormula, FormulaError, toInternalForm } from '@/lib/formula';
import { createLogger, PERSONAL_SETTING_NAMES, REDACTED_VALUE } from '@/lib/logger';

function capture(): { readonly lines: () => Array<Record<string, unknown>>; readonly stream: Writable } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const lines = () =>
    chunks
      .join('')
      .split('\n')
      .filter((line) => line !== '')
      .map((line): Record<string, unknown> => JSON.parse(line));
  return { lines, stream };
}

/** Narrows an unknown JSON value to an object without a type assertion. */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('Expected an object.');
  return Object.fromEntries(Object.entries(value));
}

function logOne(entry: Record<string, unknown>): Record<string, unknown> {
  const { lines, stream } = capture();
  createLogger({}, stream).info(entry, 'message');
  const [line] = lines();
  if (line === undefined) throw new Error('Nothing was logged.');
  return line;
}

describe('logger redaction (architecture section 9.4)', () => {
  it('writes structured JSON with the message', () => {
    const line = logOne({ requestId: 'r-1' });
    expect(line['msg']).toBe('message');
    expect(line['requestId']).toBe('r-1');
  });

  it('redacts cookies and authorisation headers', () => {
    const line = logOne({ req: { headers: { cookie: 'session=abc', authorization: 'Bearer xyz', accept: 'text/html' } } });
    const headers = asRecord(asRecord(line['req'])['headers']);
    expect(headers['cookie']).toBe(REDACTED_VALUE);
    expect(headers['authorization']).toBe(REDACTED_VALUE);
    expect(headers['accept']).toBe('text/html');
  });

  it.each([
    ['password', { user: { password: 'invented-password' } }],
    ['inputs', { estimate: { inputs: { a: 1 } } }],
    ['outputs', { estimate: { outputs: { b: 2 } } }],
    ['rates', { masters: { rates: [1, 2] } }],
    ['top-level password', { password: 'invented-password' }],
  ])('redacts %s', (_name, entry) => {
    const text = JSON.stringify(logOne(entry));
    expect(text).toContain(REDACTED_VALUE);
    expect(text).not.toContain('invented-password');
    expect(text).not.toMatch(/"a":1|"b":2|\[1,2\]/);
  });

  it.each([
    ['a token', { auth: { token: 'invented-value' } }],
    ['a secret', { client: { secret: 'invented-value' } }],
    ['a top-level secret', { secret: 'invented-value' }],
    ['a top-level authorization', { authorization: 'invented-value' }],
    ['a top-level cookie', { cookie: 'invented-value' }],
    ['a request set-cookie header', { req: { headers: { 'set-cookie': 'invented-value' } } }],
    ['a response set-cookie header', { res: { headers: { 'set-cookie': 'invented-value' } } }],
    ['an apiKey', { service: { apiKey: 'invented-value' } }],
    ['a clientSecret', { service: { clientSecret: 'invented-value' } }],
    ['a person e-mail address', { user: { email: 'someone@example.test' } }],
  ])('STD-04: redacts %s', (_name, entry) => {
    const text = JSON.stringify(logOne(entry));
    expect(text).toContain(REDACTED_VALUE);
    expect(text).not.toContain('invented-value');
    expect(text).not.toContain('someone@example.test');
  });

  it.each(SECRET_ENV_VARIABLE_NAMES)('STD-04: redacts the setting %s, at the top level and one level down', (name) => {
    const value = `invented-${name}-value`;
    expect(JSON.stringify(logOne({ [name]: value }))).not.toContain(value);
    expect(JSON.stringify(logOne({ config: { [name]: value } }))).not.toContain(value);
  });

  it('STD-04: the secret settings are exactly the secret ones of the environment list', () => {
    expect([...SECRET_ENV_VARIABLE_NAMES].sort()).toEqual(
      [
        'ADMIN_INITIAL_PASSWORD',
        'AUTH_SECRET',
        'DATABASE_URL',
        'MIGRATE_DATABASE_URL',
        'SMTP_OAUTH_CLIENT_SECRET',
        'SMTP_PASSWORD',
      ].sort(),
    );
    for (const name of SECRET_ENV_VARIABLE_NAMES) expect(ENV_VARIABLE_NAMES).toContain(name);
  });

  it.each(PERSONAL_SETTING_NAMES)('STD-23: redacts the personal or tenant setting %s, at the top level and one level down', (name) => {
    const value = `invented-${name}-value`;
    expect(JSON.stringify(logOne({ [name]: value }))).not.toContain(value);
    expect(JSON.stringify(logOne({ config: { [name]: value } }))).not.toContain(value);
  });

  it('STD-23: the personal and tenant settings are exactly the four that identify a person or a tenant', () => {
    expect([...PERSONAL_SETTING_NAMES].sort()).toEqual(
      ['ADMIN_EMAIL', 'SMTP_OAUTH_CLIENT_ID', 'SMTP_OAUTH_TENANT_ID', 'SMTP_USER'].sort(),
    );
    for (const name of PERSONAL_SETTING_NAMES) expect(ENV_VARIABLE_NAMES).toContain(name);
  });

  it('PRF-05: the doc comment warns against per-node and per-row logging at info', () => {
    const source = readFileSync(fileURLToPath(new URL('../../src/lib/logger.ts', import.meta.url)), 'utf8');
    expect(source).toContain('no per-node or per-row logging at info');
  });

  it('honours the level option', () => {
    const { lines, stream } = capture();
    createLogger({ level: 'error' }, stream).info('hidden');
    expect(lines()).toHaveLength(0);
  });

  it('exports a ready shared logger', async () => {
    const { logger } = await import('@/lib/logger');
    expect(typeof logger.info).toBe('function');
  });
});

describe('formula errors in a log line (AQP-106 STD-01)', () => {
  // Invented words that stand for formula text (Restricted): a rate name, a column and a function the person typed.
  const FORMULA_WORDS = ['Zebra42', 'QQQ', 'ROLLUPX', 'Wombat'];
  const CONTEXT = { fieldIds: ['00000000-0000-4000-8000-0fff00000001'], rates: [] };

  /** Logs a refused formula the three ways a caller would: the error, its issue, and a validation result. */
  function loggedFormulaError(text: string): string {
    const { lines, stream } = capture();
    let thrown: unknown;
    try {
      toInternalForm(text, CONTEXT);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FormulaError);
    const logger = createLogger({}, stream);
    logger.error({ err: thrown }, 'formula refused');
    if (thrown instanceof FormulaError) logger.warn({ issue: thrown.issue }, 'formula issue');
    logger.warn({ check: checkDisplayFormula(text, CONTEXT) }, 'formula check');
    return JSON.stringify(lines());
  }

  it.each(['A * Zebra42', 'A + QQQ', 'ROLLUPX(A)', 'Wombat + A'])('STD-01: no word of the formula "%s" reaches a log line', (text) => {
    const output = loggedFormulaError(text);
    for (const word of FORMULA_WORDS) expect(output).not.toContain(word);
    // The line still says what failed and where.
    expect(output).toMatch(/\(character \d+\)/);
    expect(output).toContain('"position":');
  });
});
