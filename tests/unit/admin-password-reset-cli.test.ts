import { describe, expect, it } from 'vitest';

import {
  bootstrapMode,
  EXIT_DONE,
  EXIT_FAILED,
  EXIT_NOT_ONE_ADMIN,
  EXIT_PASSWORD,
  EXIT_USAGE,
  runAdminPasswordReset,
  SERVER_COMMAND_LABEL_PREFIX,
  serverCommandActorLabel,
  windowsAccountName,
  type AdminPasswordResetDependencies,
  type AdminPasswordResetService,
} from '../../scripts/lib/admin-password-reset-cli';
import { PromptCancelledError } from '../../scripts/lib/hidden-prompt';
import { ConfigurationError, FieldValidationError, PASSWORD_RULE_CODE } from '../../src/lib/errors';

/**
 * STORY-01.10 AC-1 to AC-4 and AC-7 (AQP-428; architecture section 8 "Emergency Admin password reset"): the runner of
 * `bootstrap-admin.mjs --reset-admin-password`, driven through fake input, output and services, so no console and no database. It checks every exit
 * code and message, that nothing is asked or changed before a refusal, and that the temporary password appears in no output.
 */

const PASSWORD = 'Invented-Temp-Pass-7!';
const ADMIN = { status: 'ready', id: '00000000-0000-4000-8000-abcdef000001', name: 'Invented Admin', email: 'invented.admin@example.test' } as const;
const DONE_MESSAGE =
  'Done. The password of Invented Admin was reset. Every session they had has ended. Give them the temporary password in person or by phone. They must choose a new password at the next sign-in.';

type ReadyOrRefused = Awaited<ReturnType<AdminPasswordResetService['findAdminForServerReset']>>;
type ResetResult = Awaited<ReturnType<AdminPasswordResetService['resetAdminPasswordOnServer']>>;

interface Scenario {
  readonly interactive?: boolean;
  readonly open?: () => Promise<unknown>;
  readonly find?: () => Promise<ReadyOrRefused>;
  readonly reset?: (password: string) => Promise<ResetResult>;
  /** What the operator types, in order. A `PromptCancelledError` instance means Ctrl+C at that prompt. */
  readonly answers?: ReadonlyArray<string | PromptCancelledError>;
  readonly account?: string;
}

function run(scenario: Scenario = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const resetCalls: Array<{ context: { actorLabel: string; requestId: string }; password: string }> = [];
  const events: string[] = [];
  const answers = [...(scenario.answers ?? ['RESET', PASSWORD, PASSWORD])];
  const next = (prompt: string): Promise<string> => {
    asked.push(prompt);
    const answer = answers.shift();
    if (answer === undefined) return Promise.reject(new Error('the test gave no more answers'));
    return answer instanceof PromptCancelledError ? Promise.reject(answer) : Promise.resolve(answer);
  };
  const service: AdminPasswordResetService = {
    findAdminForServerReset: () => {
      events.push('find');
      return scenario.find === undefined ? Promise.resolve(ADMIN) : scenario.find();
    },
    resetAdminPasswordOnServer: (context, password) => {
      events.push('reset');
      resetCalls.push({ context, password });
      return scenario.reset === undefined ? Promise.resolve({ status: 'reset', id: ADMIN.id, name: ADMIN.name }) : scenario.reset(password);
    },
  };
  const dependencies: AdminPasswordResetDependencies = {
    interactive: scenario.interactive ?? true,
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    ask: (prompt) => {
      events.push('ask');
      return next(prompt);
    },
    askHidden: (prompt) => {
      events.push('askHidden');
      return next(prompt);
    },
    open: async () => {
      events.push('open');
      if (scenario.open !== undefined) await scenario.open();
      return {
        service,
        close: () => {
          events.push('close');
          return Promise.resolve();
        },
      };
    },
    windowsAccount: scenario.account ?? 'ACCUCUT\\it.person',
    newRequestId: () => 'request-0001',
  };
  return runAdminPasswordReset(dependencies).then((code) => ({
    code,
    out: out.join(''),
    err: err.join(''),
    all: out.join('') + err.join(''),
    asked,
    resetCalls,
    events,
  }));
}

describe('AC-1: which mode a run is', () => {
  it.each([
    [[], 'install'],
    [['--reset-admin-password'], 'reset-admin-password'],
    [['--reset-admin-password', '--extra'], 'usage'],
    [['--extra'], 'usage'],
    [['reset-admin-password'], 'usage'],
    [['--RESET-ADMIN-PASSWORD'], 'usage'],
    [[''], 'usage'],
  ])('the arguments %j give %s', (args, mode) => {
    expect(bootstrapMode(args)).toBe(mode);
  });

  it('the exit codes are 0 done, 1 failed, 2 not one active Admin, 3 password, 4 usage', () => {
    expect([EXIT_DONE, EXIT_FAILED, EXIT_NOT_ONE_ADMIN, EXIT_PASSWORD, EXIT_USAGE]).toEqual([0, 1, 2, 3, 4]);
  });

  it('(c) a console that is not interactive exits 4 before any settings or database work, and asks nothing', async () => {
    const result = await run({ interactive: false });
    expect(result.code).toBe(4);
    expect(result.events).toEqual([]);
    expect(result.err).toContain('needs an interactive console');
    expect(result.err).toContain('Nothing was changed.');
  });

  it('(e) settings that are missing or invalid exit 1, change nothing, and print the variable names and no value', async () => {
    const problem = new ConfigurationError('Invalid environment: DATABASE_URL (missing), AUTH_SECRET (invalid). Check .env against .env.example.', { code: 'ENV_INVALID' });
    const result = await run({ open: () => Promise.reject(problem) });
    expect(result.code).toBe(1);
    expect(result.err).toContain('bootstrap-admin failed: Invalid environment: DATABASE_URL (missing), AUTH_SECRET (invalid).');
    expect(result.events).toEqual(['open']);
    expect(result.asked).toEqual([]);
  });

  it('(e) a database that cannot be reached exits 1 and prints no database text', async () => {
    const dbError = new Error('connect ECONNREFUSED 10.1.2.3:5432 password=hunter2');
    for (const place of ['open', 'find'] as const) {
      const result = await run(place === 'open' ? { open: () => Promise.reject(dbError) } : { find: () => Promise.reject(dbError) });
      expect(result.code, place).toBe(1);
      expect(result.err, place).toContain('bootstrap-admin failed: unexpected error (see the database and the settings)');
      expect(result.all, place).not.toContain('ECONNREFUSED');
      expect(result.all, place).not.toContain('10.1.2.3');
      expect(result.all, place).not.toContain('hunter2');
      expect(result.asked, place).toEqual([]);
      // What was opened is closed again, on this path too.
      expect(result.events.includes('close'), place).toBe(place === 'find');
    }
  });
});

describe('AC-2: exactly one active Admin', () => {
  it.each([
    ['NO_ADMIN', 'No Admin account exists. Nothing was changed.'],
    ['ADMIN_INACTIVE', 'The Admin account is deactivated. This command does not reactivate it. Nothing was changed.'],
    ['MULTIPLE_ADMINS', 'More than one active Admin. Nothing was changed.'],
  ] as const)('%s exits 2 with its words, before anything is asked', async (refusal, words) => {
    const result = await run({ find: () => Promise.resolve({ status: 'refused', refusal }) });
    expect(result.code).toBe(2);
    expect(result.err).toContain(words);
    expect(result.asked).toEqual([]);
    expect(result.events).toEqual(['open', 'find', 'close']);
  });

  it('an Admin who is not the one the operator confirmed (QLT-715-01) exits 2 with new words, and nothing was changed', async () => {
    const result = await run({ reset: () => Promise.resolve({ status: 'refused', refusal: 'ADMIN_CHANGED' }) });
    expect(result.code).toBe(2);
    expect(result.err).toContain('The Admin account changed while this ran. Nothing was changed. Run it again.');
    expect(result.all).not.toContain(PASSWORD);
  });

  it('a refusal under the row lock (the Admin changed meanwhile) exits 2 with the same words', async () => {
    const result = await run({ reset: () => Promise.resolve({ status: 'refused', refusal: 'ADMIN_INACTIVE' }) });
    expect(result.code).toBe(2);
    expect(result.err).toContain('The Admin account is deactivated. This command does not reactivate it. Nothing was changed.');
  });
});

describe('AC-3: confirm, prompt, rule', () => {
  it('shows the Admin name and e-mail, asks for RESET, then the two entries at "Temporary password:" and "Type it again:"', async () => {
    const result = await run();
    expect(result.out).toContain('Invented Admin');
    expect(result.out).toContain('invented.admin@example.test');
    expect(result.asked).toHaveLength(3);
    expect(result.asked[0]).toContain('RESET');
    expect(result.asked[1]).toBe('Temporary password: ');
    expect(result.asked[2]).toBe('Type it again: ');
    expect(result.events).toEqual(['open', 'find', 'ask', 'askHidden', 'askHidden', 'reset', 'close']);
  });

  it.each(['reset', 'Reset', ' RESET', 'RESET ', '', 'yes', 'y'])('anything but RESET (%j) exits 4 and calls nothing', async (typed) => {
    const result = await run({ answers: [typed, PASSWORD, PASSWORD] });
    expect(result.code).toBe(4);
    expect(result.err).toContain('Stopped. Nothing was changed.');
    expect(result.resetCalls).toEqual([]);
    expect(result.events).toEqual(['open', 'find', 'ask', 'close']);
  });

  it('Ctrl+C at any prompt exits 4 and changes nothing', async () => {
    const cancel = new PromptCancelledError();
    const cases: Array<ReadonlyArray<string | PromptCancelledError>> = [[cancel], ['RESET', cancel], ['RESET', PASSWORD, cancel]];
    for (const answers of cases) {
      const result = await run({ answers });
      expect(result.code, JSON.stringify(answers.length)).toBe(4);
      expect(result.err).toContain('Stopped. Nothing was changed.');
      expect(result.resetCalls).toEqual([]);
      expect(result.events.at(-1)).toBe('close');
    }
  });

  it('an empty entry exits 3, either of the two', async () => {
    for (const answers of [['RESET', '', ''], ['RESET', PASSWORD, ''], ['RESET', '', PASSWORD]]) {
      const result = await run({ answers });
      expect(result.code).toBe(3);
      expect(result.err).toContain('The temporary password cannot be empty. Nothing was changed.');
      expect(result.resetCalls).toEqual([]);
    }
  });

  it('two entries that differ exit 3 and say so without printing either', async () => {
    const result = await run({ answers: ['RESET', PASSWORD, `${PASSWORD}x`] });
    expect(result.code).toBe(3);
    expect(result.err).toContain('The two entries are not the same. Nothing was changed.');
    expect(result.all).not.toContain(PASSWORD);
    expect(result.resetCalls).toEqual([]);
  });

  it('a password that breaks the rule exits 3 and prints only the part that failed', async () => {
    const refused = new FieldValidationError([{ field: 'password', message: 'Add at least one number.' }], { code: PASSWORD_RULE_CODE });
    const result = await run({ reset: () => Promise.reject(refused) });
    expect(result.code).toBe(3);
    expect(result.err).toContain('Add at least one number. Nothing was changed.');
    expect(result.all).not.toContain(PASSWORD);
    expect(result.events).toEqual(['open', 'find', 'ask', 'askHidden', 'askHidden', 'reset', 'close']);
  });
});

describe('AC-4: the password stays secret', () => {
  it('on success the password reaches the service once and appears in no output', async () => {
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.resetCalls).toHaveLength(1);
    expect(result.resetCalls[0]?.password).toBe(PASSWORD);
    expect(result.all).not.toContain(PASSWORD);
    // Nor in what the audit entry is given.
    expect(JSON.stringify(result.resetCalls[0]?.context)).not.toContain(PASSWORD);
    // The prompts are the only place the words "password" and "again" are printed for an entry: none carries a typed character.
    for (const prompt of result.asked) expect(prompt).not.toContain(PASSWORD);
  });

  it('on every refusal and failure the password appears in no output', async () => {
    const cases: Scenario[] = [
      { find: () => Promise.resolve({ status: 'refused', refusal: 'NO_ADMIN' }) },
      { answers: ['nope', PASSWORD, PASSWORD] },
      { answers: ['RESET', PASSWORD, `${PASSWORD}2`] },
      { reset: () => Promise.reject(new FieldValidationError([{ field: 'password', message: 'Add at least one symbol.' }], { code: PASSWORD_RULE_CODE })) },
      { reset: () => Promise.reject(new Error(`database said ${PASSWORD}`)) },
      { reset: () => Promise.resolve({ status: 'refused', refusal: 'MULTIPLE_ADMINS' }) },
    ];
    for (const scenario of cases) {
      const result = await run(scenario);
      expect(result.all).not.toContain(PASSWORD);
      expect(result.all).not.toContain(`${PASSWORD}2`);
      expect(result.all).not.toContain(`${PASSWORD}x`);
    }
  });

  it('an unexpected failure while resetting exits 1 with the generic words only', async () => {
    const result = await run({ reset: () => Promise.reject(new Error('relation "users" does not exist')) });
    expect(result.code).toBe(1);
    expect(result.err).toContain('bootstrap-admin failed: unexpected error (see the database and the settings)');
    expect(result.all).not.toContain('relation');
    expect(result.events.at(-1)).toBe('close');
  });
});

describe('AC-6: the label and the request the audit entry gets', () => {
  it('passes the label "System: server command (Windows account <domain>\\<user>)" and a fresh request ID', async () => {
    expect(SERVER_COMMAND_LABEL_PREFIX).toBe('System: server command (Windows account ');
    const result = await run({ account: 'ACCUCUT\\it.person' });
    // The Admin the operator was shown and confirmed is the one the reset is bound to (QLT-715-01).
    expect(result.resetCalls[0]?.context).toEqual({ actorLabel: 'System: server command (Windows account ACCUCUT\\it.person)', requestId: 'request-0001', expectedAdminId: ADMIN.id });
  });

  it('cuts the label to 200 characters', () => {
    const label = serverCommandActorLabel('D\\' + 'u'.repeat(500));
    expect(label).toHaveLength(200);
    expect(label.startsWith(SERVER_COMMAND_LABEL_PREFIX)).toBe(true);
  });

  it('keeps a short label whole, with its closing bracket', () => {
    expect(serverCommandActorLabel('A\\b')).toBe('System: server command (Windows account A\\b)');
  });

  it('turns a control character in the account name into a space, so the audit screen never shows one', () => {
    expect(serverCommandActorLabel('A\\b\u0007c\nd')).toBe('System: server command (Windows account A\\b c d)');
  });

  it('also turns format characters (a right-to-left override, a zero-width space, a line separator) into spaces (SEC-715-02)', () => {
    expect(serverCommandActorLabel('A\\b\u202Ec\u200Bd\u2028e')).toBe('System: server command (Windows account A\\b c d e)');
  });

  it('shows the Admin name and e-mail without a format character that could make the line read differently from what is stored (SEC-715-02)', async () => {
    const result = await run({ find: () => Promise.resolve({ ...ADMIN, name: 'Invented\u202E Admin' }) });
    expect(result.out).toContain('Name:   Invented  Admin');
    expect(result.out).not.toContain('\u202E');
  });

  it('the account is the domain and the user name, or the user name alone when there is no domain', () => {
    expect(windowsAccountName({ USERDOMAIN: 'ACCUCUT' }, 'it.person')).toBe('ACCUCUT\\it.person');
    expect(windowsAccountName({}, 'it.person')).toBe('it.person');
    expect(windowsAccountName({ USERDOMAIN: '' }, 'it.person')).toBe('it.person');
  });
});

describe('AC-7: the result for the operator', () => {
  it('prints the Done sentence on stdout and exits 0', async () => {
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.out).toContain(DONE_MESSAGE);
    expect(result.err).toBe('');
  });
});
