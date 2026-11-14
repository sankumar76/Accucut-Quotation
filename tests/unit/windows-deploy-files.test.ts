import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.04 (AC-1, AC-5, AC-8, AC-9, AC-10): static guards on the Windows install files and on stage 13's workflow. They read text and run no PowerShell. The
 * behaviour is proved by Pester (`deploy/windows/tests`) and by stage 13 itself on a Windows runner; these tests keep the rules that a reviewer would
 * check by eye from being edited away: nothing on a command line, no LocalSystem, pinned downloads, stage 13 outside the required check, no production Compose file.
 */

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
}

/** The text with comment lines removed, so that a rule written in a comment ("never LocalSystem") is not mistaken for code. */
function code(path: string): string {
  return read(path)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#') && !line.includes('process.env['))
    .join('\n');
}

const WORKFLOW = code('.github/workflows/windows-package.yml');
const CI = read('.github/workflows/ci.yml');
const SCRIPTS = ['deploy/windows/install.ps1', 'deploy/windows/update.ps1', 'deploy/windows/AccucutOps.psm1', 'deploy/windows/clean-logs.ps1', 'scripts/package-windows.ps1'];

describe('stage 13 workflow (AC-8, AC-9)', () => {
  it('has one job, named Stage 13: Windows package, on windows-latest, in Windows PowerShell 5.1', () => {
    expect(WORKFLOW).toMatch(/^jobs:\n {2}[\w-]+:\n {4}name: "Stage 13: Windows package"\n {4}runs-on: windows-latest$/m);
    expect(WORKFLOW).toMatch(/shell: powershell\n/);
    expect(WORKFLOW).not.toMatch(/shell: pwsh/);
    expect((WORKFLOW.match(/^ {2}[\w-]+:\n {4}name:/gm) ?? []).length).toBe(1);
  });

  it('runs on pushes to master, on pull requests that touch the Windows files, nightly and by hand', () => {
    for (const trigger of ['pull_request:', 'push:', 'schedule:', 'workflow_dispatch:']) expect(WORKFLOW).toContain(`\n  ${trigger}`);
    for (const path of ['deploy/**', 'package.json', 'package-lock.json', 'next.config.ts', 'prisma/**', 'src/worker/**']) expect(WORKFLOW).toContain(`'${path}'`);
    expect(WORKFLOW).toMatch(/branches: \[master\]/);
  });

  it('is not part of the required check: its job is not a needed job of the fan-in, and ci.yml does not name it', () => {
    expect(CI).not.toContain('Stage 13: Windows package');
    expect(CI).not.toContain('windows-package');
    // The fan-in needs exactly the two jobs it needed before this story.
    expect(CI).toMatch(/needs: \[verify, e2e\]/);
    expect(WORKFLOW).not.toMatch(/^\s+needs:/m);
  });

  it('keeps the security rules of ci.yml: pull_request only, read-only token, no secret, actions pinned to a commit', () => {
    expect(WORKFLOW).not.toContain('pull_request_target');
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(WORKFLOW).not.toMatch(/secrets\./);
    const uses = [...WORKFLOW.matchAll(/^\s+uses: (\S+)/gm)].map((match) => match[1] ?? '');
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
  });

  it('pins Node and npm as ci.yml does, and uses the same checkout and setup-node commits', () => {
    for (const key of ['NODE_VERSION', 'NPM_VERSION']) {
      const here = WORKFLOW.match(new RegExp(`${key}: '([^']+)'`))?.[1];
      const there = CI.match(new RegExp(`${key}: '([^']+)'`))?.[1];
      expect(here).toBeDefined();
      expect(here).toBe(there);
    }
    for (const action of ['actions/checkout', 'actions/setup-node']) {
      const here = WORKFLOW.match(new RegExp(`${action}@([0-9a-f]{40})`))?.[1];
      const there = CI.match(new RegExp(`${action}@([0-9a-f]{40})`))?.[1];
      expect(here).toBeDefined();
      expect(here).toBe(there);
    }
  });

  it('runs the steps of test strategy 10.8 in order: build, package, PostgreSQL, install, assert, update, rollback, Pester', () => {
    const order = ['npm ci', 'npm run build', 'package-windows.ps1', 'postgresql-x64-17', 'install.ps1', 'assert-install.ps1', 'update.ps1', 'Call your IT person', 'Invoke-Pester'];
    let position = -1;
    for (const marker of order) {
      const found = WORKFLOW.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
  });

  it('passes no secret on a command line: the administrator password goes in through standard input and the values file holds the rest', () => {
    expect(WORKFLOW).toContain('--file -');
    expect(WORKFLOW).not.toMatch(/(?<![-\w])-Password\b/i);
    expect(WORKFLOW).not.toMatch(/PGPASSWORD=\S/);
    expect(WORKFLOW).toContain('::add-mask::');
    expect(WORKFLOW).toMatch(/Remove-Item -LiteralPath \$env:ACCUCUT_VALUES/);
  });
});

describe('the pinned programs (AC-8)', () => {
  const TOOLS = read('deploy/windows/tools.psd1');

  it('names WinSW 2.12.0 and age with a version, an address and a 64-character SHA-256 each', () => {
    expect(TOOLS).toMatch(/Version = '2\.12\.0'/);
    expect([...TOOLS.matchAll(/Sha256\s+= '([0-9a-f]{64})'/g)]).toHaveLength(2);
    expect([...TOOLS.matchAll(/Url\s+= 'https:\/\/github\.com\/[^']+'/g)]).toHaveLength(2);
    expect(TOOLS).toMatch(/releases\/download\/v2\.12\.0\/WinSW-x64\.exe/);
  });

  it('the workflow and the package script both refuse a download whose hash differs', () => {
    expect(WORKFLOW).toMatch(/does not match its pinned SHA-256/);
    expect(read('scripts/package-windows.ps1')).toMatch(/does not match its pinned SHA-256/);
  });
});

describe('the scripts (AC-1, AC-5)', () => {
  it('are for Windows PowerShell 5.1: no PowerShell 7 syntax', () => {
    for (const path of SCRIPTS) {
      const text = code(path);
      expect(text, `${path} uses the ternary operator`).not.toMatch(/\)\s*\?\s*[^\s]+\s*:\s*[^\s]+/);
      expect(text, `${path} uses && or ||`).not.toMatch(/\s&&\s|\s\|\|\s/);
      expect(text, `${path} uses ??`).not.toMatch(/\?\?/);
      expect(text, `${path} asks for PowerShell 7`).not.toMatch(/#requires -version 7/i);
    }
  });

  it('put no password on a command line: no -Password parameter, no secret in an argument list, no ConvertTo-SecureString -AsPlainText', () => {
    for (const path of SCRIPTS) {
      const text = code(path);
      expect(text, `${path} has a -Password parameter`).not.toMatch(/-(?:Pg|Db)?Password\b(?!\w)/);
      expect(text, `${path} converts a plain text secret`).not.toMatch(/-AsPlainText/i);
      expect(text, `${path} writes a secret to the host`).not.toMatch(/Write-Host[^\n]*\$\w*(?:Password|Secret)\w*/);
    }
  });

  it('hand a secret to a child process only through its environment or its standard input', () => {
    const install = code('deploy/windows/install.ps1');
    expect(install).toMatch(/PGPASSWORD\s+= \$Connection\.Password/);
    expect(install).not.toMatch(/--password/i);
    const ops = code('deploy/windows/AccucutOps.psm1');
    expect(ops).toMatch(/EnvironmentVariables\[/);
    expect(ops).toMatch(/MIGRATE_DATABASE_URL\s+= \$MigrateDatabaseUrl/);
  });

  it('create no service as LocalSystem: the account is a virtual account set with sc.exe and checked', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    expect(ops).toMatch(/'obj=', "NT SERVICE\\\$Name"/);
    expect(ops).toMatch(/Assert-AccucutServiceIdentity/);
    for (const name of ['AccucutApp', 'AccucutWorker']) {
      const xml = read(`deploy/windows/services/${name}.xml`).replace(/<!--[\s\S]*?-->/g, '');
      expect(xml).not.toMatch(/localsystem|serviceaccount|password/i);
      expect(xml).toContain('<depend>postgresql-x64-17</depend>');
      expect(xml).toContain('<delayedAutoStart>true</delayedAutoStart>');
      expect(xml).toMatch(/<onfailure action="restart" delay="10 sec"\/>\s*<onfailure action="restart" delay="30 sec"\/>\s*<onfailure action="restart" delay="60 sec"\/>/);
      expect(xml).toContain('<log mode="roll-by-time">');
    }
  });

  it('install: checks the zip, makes a fresh locked folder, checks the COPY of the zip, then reads only from the unpacked copy (security review)', () => {
    const install = code('deploy/windows/install.ps1');
    const first = install.slice(install.indexOf('function Initialize-AccucutVerifiedRelease'), install.indexOf('function Get-AccucutPostgresInstall'));
    const order = [
      'Get-FileHash -LiteralPath $ZipPath',
      'Assert-AccucutFreshRoot -Root $Root',
      'New-Item -ItemType Directory -Path $full | Out-Null',
      'Set-AccucutDirectoryAcl -Path $full',
      'Copy-Item -LiteralPath $ZipPath -Destination $copy',
      'Get-FileHash -LiteralPath $copy',
      'Expand-AccucutBootstrapZip -ZipPath $copy',
    ];
    let position = -1;
    for (const marker of order) {
      const found = first.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    // The folder is refused unless new, or empty and owned by Administrators or SYSTEM; the owner is set to Administrators.
    expect(install).toContain("@('S-1-5-32-544', 'S-1-5-18') -notcontains $owner");
    expect(install).toMatch(/SetOwner\(\(New-Object System\.Security\.Principal\.SecurityIdentifier\(\[System\.Security\.Principal\.WellKnownSidType\]::BuiltinAdministratorsSid/);
    // The second half never touches the folder IT unpacked into or the zip: it has no zip parameter and copies no tree.
    const second = install.slice(install.indexOf('function Invoke-AccucutInstall'), install.indexOf('function Start-AccucutInstall'));
    expect(second).not.toContain('$ZipPath');
    expect(second).not.toContain('Copy-AccucutTree');
    expect(second).toContain('Assert-AccucutFolderTrusted -Path $paths.Root');
    expect(second).toContain("(Join-Path $PackageRoot '.env.example')");
    expect(second).toContain("Join-Path $releaseDirectory 'sql\\create-roles.psql'");
    // The entry point runs the copy of the script that is in the unpacked release.
    expect(install).toContain("$verifiedScript = Join-Path $verified 'install.ps1'");
  });

  it('settings files: locked before they are filled', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    expect(ops.indexOf('WriteAllBytes($Path')).toBeLessThan(ops.indexOf('Set-AccucutFileAcl -Path $Path'));
    expect(ops.indexOf('Set-AccucutFileAcl -Path $Path')).toBeLessThan(ops.indexOf('WriteAllText($Path'));
  });

  it('the update takes the backup before it stops anything, and rolls the junction back on a failed health check', () => {
    const update = code('deploy/windows/update.ps1');
    // Security review: the install folder is checked before anything is written, and the zip is copied in and its COPY checked before it is unpacked.
    const trustAt = update.indexOf('Assert-AccucutInstallTrusted -Paths $paths');
    expect(trustAt).toBeGreaterThan(0);
    expect(update.indexOf('Assert-AccucutUpdateRunsFromInstall -Paths $paths')).toBeGreaterThan(0);
    expect(trustAt).toBeLessThan(update.indexOf('Invoke-AccucutReleaseBackup -Paths $paths'));
    const copyAt = update.indexOf('Copy-Item -LiteralPath $ZipPath -Destination $copy');
    expect(copyAt).toBeGreaterThan(trustAt);
    expect(update.indexOf('Assert-AccucutSha256 -Path $copy')).toBeGreaterThan(copyAt);
    expect(update.indexOf('Expand-AccucutZip -ZipPath $copy')).toBeGreaterThan(update.indexOf('Assert-AccucutSha256 -Path $copy'));
    expect(update.indexOf('Invoke-AccucutReleaseBackup -Paths $paths')).toBeLessThan(update.indexOf('Stop-AccucutServices\n'));
    expect(update).toContain("Call your IT person");
    expect(update.indexOf('Set-AccucutCurrentRelease -Paths $paths -Tag $oldTag')).toBeGreaterThan(update.indexOf('Set-AccucutCurrentRelease -Paths $paths -Tag $newTag'));
    expect(update).toMatch(/Remove-AccucutOldReleases -Paths \$paths -Keep @\(\$newTag, \$oldTag\)/);
  });
});

describe('the repository after this story (AC-10)', () => {
  it('has no Dockerfile and no production Compose file; the development database file stays', () => {
    const tracked = read('compose.dev.yml');
    expect(tracked).toContain('Local development database only');
    expect(tracked).toContain('/opt/accucut/db/create-roles.psql');
    for (const missing of ['Dockerfile', 'docker-compose.yml', 'compose.yml', 'compose.prod.yml']) {
      expect(() => readFileSync(fileURLToPath(new URL(`../../${missing}`, import.meta.url)))).toThrow();
    }
  });

  it('keeps one SQL source of the two roles, which the development database and the Windows install both read', () => {
    expect(read('deploy/db/create-roles.psql')).toContain('CREATE ROLE accucut_owner LOGIN PASSWORD');
    expect(read('docker/postgres-init/01-create-roles.sh')).toContain('--file "$roles_sql"');
    expect(read('deploy/windows/install.ps1')).toContain("sql\\create-roles.psql");
    expect(read('scripts/package-windows.ps1')).toContain('deploy\\db\\create-roles.psql');
  });
});
