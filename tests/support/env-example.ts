import { PLACEHOLDER_PREFIX } from '@/lib/env';

/**
 * What a value in `.env.example` may be (STD-05, STD-21, QLT-19, NFR-006). The repository is public, so a
 * real tenant ID, host or e-mail address pasted into the template must fail a test, not pass because its
 * name was not on a short list. A value is safe if it is empty, starts with the CHANGE_ME placeholder, or
 * is one of these named literals that are the same on every machine. The two database URLs follow a rule
 * of their own: a local host and a placeholder password. "Contains CHANGE_ME" is never enough, because a
 * real host kept next to a placeholder would pass.
 */
export const SAFE_LITERALS: Readonly<Record<string, string>> = {
  APP_ORIGIN: 'http://localhost:3000',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_AUTH_MODE: 'none',
};

const DATABASE_URL_VARIABLES: ReadonlyArray<string> = ['DATABASE_URL', 'MIGRATE_DATABASE_URL'];
const LOCAL_DATABASE_HOSTS: ReadonlyArray<string> = ['localhost', '127.0.0.1'];
const INVENTED_EMAIL_SUFFIX = '@example.test';

/** A database URL is safe when its host is local and its password is a placeholder. */
export function isSafeDatabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return LOCAL_DATABASE_HOSTS.includes(url.hostname) && decodeURIComponent(url.password).startsWith(PLACEHOLDER_PREFIX);
  } catch {
    return false;
  }
}

function isSafe(name: string, value: string): boolean {
  if (value === '') return true;
  if (DATABASE_URL_VARIABLES.includes(name)) return isSafeDatabaseUrl(value);
  if (value.startsWith(PLACEHOLDER_PREFIX)) return true;
  if (SAFE_LITERALS[name] === value) return true;
  return name === 'ADMIN_EMAIL' && value.endsWith(INVENTED_EMAIL_SUFFIX);
}

/** The names whose value is neither empty, a placeholder, a named safe literal nor a safe database URL. */
export function unsafeExampleEntries(values: ReadonlyMap<string, string>): string[] {
  return [...values].filter(([name, value]) => !isSafe(name, value)).map(([name]) => name);
}
