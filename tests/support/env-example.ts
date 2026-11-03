import { PLACEHOLDER_PREFIX } from '@/lib/env';

/**
 * What a value in `.env.example` may be (STD-05, NFR-006). The repository is public, so a real tenant
 * ID, host or e-mail address pasted into the template must fail a test, not pass because its name was
 * not on a short list. A value is safe if it is empty, a CHANGE_ME placeholder (or a URL holding one),
 * or one of these named literals that are the same on every machine.
 */
export const SAFE_LITERALS: Readonly<Record<string, string>> = {
  APP_ORIGIN: 'http://localhost:3000',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_AUTH_MODE: 'none',
};

const INVENTED_EMAIL_SUFFIX = '@example.test';

function isSafe(name: string, value: string): boolean {
  if (value === '' || value.includes(PLACEHOLDER_PREFIX)) return true;
  if (SAFE_LITERALS[name] === value) return true;
  return name === 'ADMIN_EMAIL' && value.endsWith(INVENTED_EMAIL_SUFFIX);
}

/** The names whose value is neither empty, a placeholder nor a named safe literal. */
export function unsafeExampleEntries(values: ReadonlyMap<string, string>): string[] {
  return [...values].filter(([name, value]) => !isSafe(name, value)).map(([name]) => name);
}
