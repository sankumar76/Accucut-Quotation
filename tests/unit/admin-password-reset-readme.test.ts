import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-01.10 AC-9 (AQP-428; DL-381 (3)(b); architecture section 8 "the README section text"): `deploy/windows/README.md` holds the section "If the Admin forgets their password" with the elevated PowerShell lines, the Node
 * path taken from the service file, the four steps, the exit codes, and the instruction to note the date and the Windows account in the server's operations record. It says the temporary password is never shared in chat, Jira or GitHub.
 */

const README = readFileSync(fileURLToPath(new URL('../../deploy/windows/README.md', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

function sectionOf(heading: string): string {
  const start = README.indexOf(`\n## ${heading}\n`);
  expect(start, `the section "${heading}"`).toBeGreaterThanOrEqual(0);
  const next = README.indexOf('\n## ', start + 1);
  return README.slice(start, next === -1 ? undefined : next);
}

describe('AC-9: the README section for a forgotten Admin password', () => {
  const section = sectionOf('If the Admin forgets their password');

  it('is its own section, after "Restore a backup" and before the shared module', () => {
    expect(README.indexOf('\n## Restore a backup')).toBeLessThan(README.indexOf('\n## If the Admin forgets their password\n'));
    expect(README.indexOf('\n## If the Admin forgets their password\n')).toBeLessThan(README.indexOf('\n## The shared module'));
  });

  it('gives the four elevated PowerShell lines, with the Node path taken from the service file and the settings from .env', () => {
    expect(section).toContain('Run as administrator');
    expect(section).toContain("$node = (Select-Xml -Path C:\\Accucut\\services\\AccucutApp.xml -XPath '/service/executable').Node.InnerText");
    expect(section).toContain('cd C:\\Accucut\\current\\app');
    expect(section).toContain("$env:NODE_ENV = 'production'");
    expect(section).toContain('& $node --env-file=C:\\Accucut\\config\\.env bootstrap-admin.mjs --reset-admin-password');
    expect(section).not.toContain('migrate.env');
  });

  it('says what the operator types and sees, and who the temporary password is shared with', () => {
    expect(section).toContain('type `RESET`');
    expect(section).toContain('twice');
    expect(section).toContain('nothing shows as you type');
    expect(section).toContain('in person or by phone, never by e-mail or chat');
    expect(section).toContain('"System: server command"');
  });

  it('tells the operator to note the date and the Windows account in the operations record, and never to write the password in chat, Jira or GitHub (DL-381 (3)(b))', () => {
    expect(section).toContain("Note the date and your Windows account in the server's operations record");
    expect(section).toMatch(/Never write the temporary password in chat, Jira, GitHub/);
  });

  it('lists the five exit codes', () => {
    for (const row of ['| 0 | Done |', '| 2 | Not exactly one active Admin: nothing was changed |', '| 4 | Stopped: not an interactive window, `RESET` not typed, or Ctrl+C |']) {
      expect(section).toContain(row);
    }
    expect(section.match(/^\| [0-4] \|/gm)).toHaveLength(5);
  });
});
