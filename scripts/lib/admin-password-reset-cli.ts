import { isAppError, PASSWORD_RULE_CODE } from '../../src/lib/errors';
import type { ServerResetRefusal, UserService } from '../../src/server/services/user-service';

import { PromptCancelledError } from './hidden-prompt';

/**
 * The runner of `bootstrap-admin.mjs --reset-admin-password` (STORY-01.10; DL-380 to DL-382; architecture section 8 "Emergency Admin password reset"): the emergency command a server administrator runs, on the
 * server, to give the one Admin a temporary password when e-mail is off and they have forgotten theirs. It takes its input, output and services as arguments, so a test drives it with no console and no
 * database; `scripts/bootstrap-admin.ts` wires the real ones.
 *
 * The order is the contract (AC-1 to AC-4):
 *   1. not an interactive console on both input and output: exit 4, before any settings or database work;
 *   2. the settings and the database (`open`): a failure is exit 1, with the words of a settings problem (variable names, never values) or a generic line, never database text;
 *   3. exactly one active Admin, or exit 2 with its words; the Admin's name and e-mail are shown;
 *   4. `RESET` typed, or exit 4 (so does Ctrl+C at any prompt); the temporary password twice at a hidden prompt, or exit 3 (empty, or the two differ);
 *   5. the service: the rule (FR-098) then the one transaction. A refusal under the lock is exit 2, a rule failure exit 3 with only the part that failed.
 *
 * **The password is only ever a prompt's answer** (DL-381 (2)(a)): it is passed on once, to the service, and is in no argument, environment, file, log, message or audit entry. Nothing the runner prints
 * carries it, on success or on any refusal. Every refusal says "Nothing was changed."
 */

export const EXIT_DONE = 0;
export const EXIT_FAILED = 1;
export const EXIT_NOT_ONE_ADMIN = 2;
export const EXIT_PASSWORD = 3;
export const EXIT_USAGE = 4;

export type ExitCode = typeof EXIT_DONE | typeof EXIT_FAILED | typeof EXIT_NOT_ONE_ADMIN | typeof EXIT_PASSWORD | typeof EXIT_USAGE;

/** The one argument that starts the reset. */
export const RESET_ARGUMENT = '--reset-admin-password';

/** What the step does for the arguments it was started with: today's install path, the reset, or a refusal. Only the one exact argument starts the reset. */
export function bootstrapMode(args: ReadonlyArray<string>): 'install' | 'reset-admin-password' | 'usage' {
  if (args.length === 0) return 'install';
  return args.length === 1 && args[0] === RESET_ARGUMENT ? 'reset-admin-password' : 'usage';
}

/** The words of exit 4 for an argument that is not the one. */
export const USAGE_MESSAGE = `bootstrap-admin: unknown argument. The only argument is ${RESET_ARGUMENT}, run on the server in an elevated PowerShell window. Nothing was changed.`;

const NOT_INTERACTIVE_MESSAGE = `bootstrap-admin: ${RESET_ARGUMENT} needs an interactive console for both input and output: run it in a PowerShell window, not from a script, a pipe or a service. Nothing was changed.`;
const STOPPED_MESSAGE = 'Stopped. Nothing was changed.';
const EMPTY_MESSAGE = 'The temporary password cannot be empty. Nothing was changed.';
const DIFFERENT_MESSAGE = 'The two entries are not the same. Nothing was changed.';
const GENERIC_FAILURE = 'unexpected error (see the database and the settings)';

const REFUSAL_MESSAGE: Readonly<Record<ServerResetRefusal, string>> = {
  NO_ADMIN: 'No Admin account exists. Nothing was changed.',
  ADMIN_INACTIVE: 'The Admin account is deactivated. This command does not reactivate it. Nothing was changed.',
  MULTIPLE_ADMINS: 'More than one active Admin. Nothing was changed.',
  ADMIN_CHANGED: 'The Admin account changed while this ran. Nothing was changed. Run it again.',
};

const CONFIRM_WORD = 'RESET';
const CONFIRM_PROMPT = `Type ${CONFIRM_WORD} to set a temporary password for this Admin, or anything else to stop: `;
const PASSWORD_PROMPT = 'Temporary password: ';
const REPEAT_PROMPT = 'Type it again: ';

/** The start of the audit label that says a system action, from a Windows account (DL-381 (3)(a): a test pins it). */
export const SERVER_COMMAND_LABEL_PREFIX = 'System: server command (Windows account ';
/** The longest `actor_label` the audit log takes. */
const LABEL_MAX_LENGTH = 200;

/**
 * Text that is printed or stored comes from the machine or the database, so a control character in it becomes a space and cannot move the cursor or clear the screen, and neither can a format character
 * (a right-to-left override, a zero-width space) make the line read differently from what is stored (SEC-715-02). The set is the project's own (`src/lib/estimate/validation.ts`).
 */
function printable(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/gu, ' ');
}

/** `System: server command (Windows account <domain>\<user>)`, cut to 200 characters (never in the middle of a character). */
export function serverCommandActorLabel(windowsAccount: string): string {
  const label = `${SERVER_COMMAND_LABEL_PREFIX}${printable(windowsAccount)})`;
  if (label.length <= LABEL_MAX_LENGTH) return label;
  const cut = label.slice(0, LABEL_MAX_LENGTH);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** The Windows account that runs the process, as the label names it: `<USERDOMAIN>\<user name>`, or the user name alone when there is no domain. It comes from the process and is not proof of who it is (DL-381 (3)(b)). */
export function windowsAccountName(environment: Readonly<Record<string, string | undefined>>, userName: string): string {
  const domain = environment['USERDOMAIN'];
  return domain === undefined || domain === '' ? userName : `${domain}\\${userName}`;
}

/** What the runner uses of the user service: the two methods of the server command. */
export type AdminPasswordResetService = Pick<UserService, 'findAdminForServerReset' | 'resetAdminPasswordOnServer'>;

export interface AdminPasswordResetDependencies {
  /** Both input and output are a console (`isTTY` on both). */
  readonly interactive: boolean;
  /** Normal output (stdout). */
  readonly out: (text: string) => void;
  /** Refusals and failures (stderr). */
  readonly err: (text: string) => void;
  /** A line with what is typed shown (for `RESET`). Rejects with `PromptCancelledError` on Ctrl+C. */
  readonly ask: (prompt: string) => Promise<string>;
  /** A line with nothing shown (the password). Rejects with `PromptCancelledError` on Ctrl+C. */
  readonly askHidden: (prompt: string) => Promise<string>;
  /** Reads the settings and opens the database. Its failure is exit 1. `close` is called once the run is over, whatever the result. */
  readonly open: () => Promise<{ readonly service: AdminPasswordResetService; readonly close: () => Promise<void> }>;
  /** `<USERDOMAIN>\<user name>` for the audit label. */
  readonly windowsAccount: string;
  /** A fresh request ID for the audit entry. */
  readonly newRequestId: () => string;
}

/** The failure line of the step: a settings problem names its variables (never a value, `src/lib/env.ts`); anything else, a database error included, is the generic line. */
function failureLine(error: unknown): string {
  return `bootstrap-admin failed: ${isAppError(error) ? error.message : GENERIC_FAILURE}\n`;
}

async function converse(deps: AdminPasswordResetDependencies, service: AdminPasswordResetService): Promise<ExitCode> {
  const found = await service.findAdminForServerReset();
  if (found.status === 'refused') {
    deps.err(`${REFUSAL_MESSAGE[found.refusal]}\n`);
    return EXIT_NOT_ONE_ADMIN;
  }
  const name = printable(found.name);
  deps.out(`This sets a temporary password for the Admin:\n  Name:   ${name}\n  E-mail: ${printable(found.email)}\n`);
  if ((await deps.ask(CONFIRM_PROMPT)) !== CONFIRM_WORD) {
    deps.err(`${STOPPED_MESSAGE}\n`);
    return EXIT_USAGE;
  }
  const first = await deps.askHidden(PASSWORD_PROMPT);
  const second = await deps.askHidden(REPEAT_PROMPT);
  if (first === '' || second === '') {
    deps.err(`${EMPTY_MESSAGE}\n`);
    return EXIT_PASSWORD;
  }
  if (first !== second) {
    deps.err(`${DIFFERENT_MESSAGE}\n`);
    return EXIT_PASSWORD;
  }
  const result = await service.resetAdminPasswordOnServer(
    // The reset is bound to the Admin the operator confirmed: it acts on that account or on none (QLT-715-01).
    { actorLabel: serverCommandActorLabel(deps.windowsAccount), requestId: deps.newRequestId(), expectedAdminId: found.id },
    first,
  );
  if (result.status === 'refused') {
    deps.err(`${REFUSAL_MESSAGE[result.refusal]}\n`);
    return EXIT_NOT_ONE_ADMIN;
  }
  deps.out(
    `Done. The password of ${printable(result.name)} was reset. Every session they had has ended. Give them the temporary password in person or by phone. They must choose a new password at the next sign-in.\n`,
  );
  return EXIT_DONE;
}

/** Runs the command and returns the exit code. Never throws: every path ends in a code and a line. */
export async function runAdminPasswordReset(deps: AdminPasswordResetDependencies): Promise<ExitCode> {
  if (!deps.interactive) {
    deps.err(`${NOT_INTERACTIVE_MESSAGE}\n`);
    return EXIT_USAGE;
  }
  let opened: Awaited<ReturnType<AdminPasswordResetDependencies['open']>>;
  try {
    opened = await deps.open();
  } catch (error) {
    deps.err(failureLine(error));
    return EXIT_FAILED;
  }
  try {
    return await converse(deps, opened.service);
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      deps.err(`${STOPPED_MESSAGE}\n`);
      return EXIT_USAGE;
    }
    if (isAppError(error) && error.code === PASSWORD_RULE_CODE) {
      // The message is the rule's own words for the part that failed and holds nothing of the password.
      deps.err(`${error.message} Nothing was changed.\n`);
      return EXIT_PASSWORD;
    }
    deps.err(failureLine(error));
    return EXIT_FAILED;
  } finally {
    // The result is decided; a database that will not disconnect cleanly changes nothing for the operator.
    await opened.close().catch(() => undefined);
  }
}
