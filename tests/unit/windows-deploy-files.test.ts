import { readdirSync, readFileSync } from 'node:fs';
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

/** The text of one PowerShell function, from `function Name {` to the next top-level function (or the end of the text). */
function functionBody(text: string, name: string): string {
  const start = text.indexOf(`function ${name} {`);
  expect(start, `function ${name} is missing`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf('\nfunction ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

const WORKFLOW = code('.github/workflows/windows-package.yml');
const CI = read('.github/workflows/ci.yml');
const SCRIPTS = [
  'deploy/windows/install.ps1',
  'deploy/windows/update.ps1',
  'deploy/windows/backup.ps1',
  'deploy/windows/clear-copies.ps1',
  'deploy/windows/AccucutOps.psm1',
  'scripts/package-windows.ps1',
  'deploy/windows/ci/exercise-backup.ps1',
];

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

  it('proves ADR-015 Amendment 2 end to end on the real install: a tampered module is never loaded, a writable module stops the update, an existing folder is refused', () => {
    // (i) A module that writes a marker and throws is planted in the unpacked folder next to the true zip; the install must not load it.
    expect(WORKFLOW).toContain("$package = 'C:\\accucut-pkg'");
    expect(WORKFLOW).toContain('accucut-tampered-module-marker.txt');
    expect(WORKFLOW).toContain("Join-Path $package 'AccucutOps.psm1'");
    expect(WORKFLOW).toContain("if (Test-Path -LiteralPath $env:ACCUCUT_MARKER) { throw 'The tampered module in the unpacked folder was loaded by the install.' }");
    // (ii) The Users group may write the module of the running release: update.ps1 exits 1 before loading anything, the services keep running, and the permission is removed.
    expect(WORKFLOW).toContain("/grant '*S-1-5-32-545:(W)'");
    expect(WORKFLOW).toContain("/remove:g '*S-1-5-32-545'");
    expect(WORKFLOW).toContain('if ($code -ne 1) { throw "update.ps1 should have exited with code 1');
    expect(WORKFLOW).toContain('can be changed by S-1-5-32-545');
    expect(WORKFLOW).toMatch(/finally \{[^}]*icacls\.exe[^}]*\/remove:g/);
    // (iii) install.ps1 -Root C:\AccucutPre over an existing empty folder is refused, and the folder is left exactly as it was (same permissions, still empty).
    expect(WORKFLOW).toContain('-Root $pre -NonInteractive');
    expect(WORKFLOW).toContain("$pre = 'C:\\AccucutPre'");
    expect(WORKFLOW).toContain('(Get-Acl -LiteralPath $pre).Sddl -ne $before');
    // The steps run in the order that makes them meaningful: refuse the existing folder, then install, then update, then the writable-module refusal, then the broken release.
    const order = ['Unpack the package', 'Refuse an install folder that already exists', 'Install from the unpacked zip', 'Update to the second release', 'Refuse an update when a user could have changed', 'Update to a broken release'];
    let position = -1;
    for (const marker of order) {
      const found = WORKFLOW.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
  });

  it('runs the install with node.exe from C:\\Program Files\\nodejs by its full path, using the pinned MSI only when the image has no Node.js 22.12 or later', () => {
    expect(WORKFLOW).toContain("$node = 'C:\\Program Files\\nodejs\\node.exe'");
    expect(WORKFLOW).toContain('-NodeExe $env:ACCUCUT_NODE');
    expect(WORKFLOW).toContain('(Import-PowerShellDataFile -LiteralPath deploy/windows/tools.psd1).Node');
    expect(WORKFLOW).toContain('does not match its pinned SHA-256 (expected $($tool.Sha256)');
    expect(WORKFLOW.indexOf('Make sure Node.js 22.12 or later')).toBeLessThan(WORKFLOW.indexOf('Install from the unpacked zip'));
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

  it('names WinSW 2.12.0, age and (stage 13 only) Node.js with a version, an address and a 64-character SHA-256 each', () => {
    expect(TOOLS).toMatch(/Version = '2\.12\.0'/);
    expect([...TOOLS.matchAll(/Sha256\s+= '([0-9a-f]{64})'/g)]).toHaveLength(3);
    expect([...TOOLS.matchAll(/Url\s+= 'https:\/\/(?:github\.com|nodejs\.org)\/[^']+'/g)]).toHaveLength(3);
    expect(TOOLS).toMatch(/Url\s+= 'https:\/\/nodejs\.org\/dist\/v22\.\d+\.\d+\/node-v22\.\d+\.\d+-x64\.msi'/);
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

  it('put no password on a command line: no -Password parameter (except the two cmdlets of Register-AccucutBackupTask, below), no secret in an argument list, no ConvertTo-SecureString -AsPlainText', () => {
    for (const path of SCRIPTS) {
      let text = code(path);
      if (path.endsWith('AccucutOps.psm1')) text = text.replace(functionBody(text, 'Register-AccucutBackupTask'), '');
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

  it('the password of AccucutBackup is made in memory and reaches only New-LocalUser (as a SecureString) and Register-ScheduledTask (in process): never a native program, a file or a log (ADR-015 Amendment 3 point 2)', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    const body = functionBody(ops, 'Register-AccucutBackupTask');
    expect(body).toContain('$password = New-AccucutComplexPassword -Length 32');
    expect(body.indexOf('Register-AccucutSecret -Value $password')).toBeGreaterThan(body.indexOf('New-AccucutComplexPassword'));
    expect(body).toContain('New-LocalUser -Name $script:BackupAccountName -Password $secure -PasswordNeverExpires -UserMayNotChangePassword -AccountNeverExpires');
    expect(body).toContain('-User "$($env:COMPUTERNAME)\\$($script:BackupAccountName)" -Password $password -RunLevel Limited');
    expect((body.match(/-Password\b/g) ?? []).length).toBe(2);
    expect(body).not.toMatch(/Invoke-AccucutNative|Write-AccucutLog|Write-Host|Out-File|Set-Content|WriteAllText|Add-LocalGroupMember/);
    expect(body).toContain('$password = $null');
    expect(body).toContain('$secure.Dispose()');
    expect(body).toContain('Remove-AccucutBackupAccount');
    // Nothing else in the module or the scripts makes a user, a task or a group member.
    expect((ops.match(/New-LocalUser/g) ?? []).length).toBe(1);
    expect((ops.match(/Register-ScheduledTask/g) ?? []).length).toBe(1);
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1', 'deploy/windows/backup.ps1', 'deploy/windows/clear-copies.ps1']) {
      expect(code(path), path).not.toMatch(/New-LocalUser|Register-ScheduledTask|Add-LocalGroupMember|ConvertTo-SecureString|net user|net1 user/i);
    }
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

  it('the trust block (ADR-015 Amendment 2) is one copy, byte for byte the same in install.ps1, update.ps1, backup.ps1 and clear-copies.ps1, and nowhere else', () => {
    const install = read('deploy/windows/install.ps1');
    const update = read('deploy/windows/update.ps1');
    const backup = read('deploy/windows/backup.ps1');
    const clear = read('deploy/windows/clear-copies.ps1');
    const pattern = /# >>> ACCUCUT TRUST BLOCK v1\n[\s\S]*?# <<< ACCUCUT TRUST BLOCK v1/;
    for (const text of [install, update, backup, clear]) {
      expect((text.match(/# >>> ACCUCUT TRUST BLOCK v1/g) ?? []).length).toBe(1);
      expect((text.match(/# <<< ACCUCUT TRUST BLOCK v1/g) ?? []).length).toBe(1);
    }
    const block = install.match(pattern)?.[0] ?? '';
    expect(block.length).toBeGreaterThan(10_000);
    expect(update.match(pattern)?.[0]).toBe(block);
    expect(backup.match(pattern)?.[0]).toBe(block);
    expect(clear.match(pattern)?.[0]).toBe(block);
    // The block defines its 18 functions, and none of them is defined outside it (in a script or in the module).
    const names = [...block.matchAll(/^function ([\w-]+) \{$/gm)].map((match) => match[1] ?? '');
    expect(names).toHaveLength(19);
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1', 'deploy/windows/backup.ps1', 'deploy/windows/clear-copies.ps1', 'deploy/windows/AccucutOps.psm1']) {
      const outside = read(path).replace(pattern, '');
      for (const name of names) expect(outside, `${path} defines ${name} outside the block`).not.toContain(`function ${name}`);
    }
  });

  it('the module holds no trust, root, package or script-running function: it is loaded only after it was checked, so it cannot check itself', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    for (const gone of [
      'Assert-AccucutPathTrusted', 'Get-AccucutPathSecurity', 'Assert-AccucutFreshRoot', 'Assert-AccucutLockedInstallRoot', 'Assert-AccucutInstallTrusted', 'New-AccucutDirectorySecurity',
      'New-AccucutLockedDirectory', 'Set-AccucutDirectoryAcl', 'Expand-AccucutZip', 'Assert-AccucutSha256', 'Import-AccucutBootstrapModule', 'Assert-AccucutFolderTrusted',
      'Assert-AccucutParentNotSwappable', 'Assert-AccucutBootstrapFolder', 'Get-AccucutNonAdminWriters', 'Get-AccucutFolderOwnerSid',
    ]) {
      expect(ops, `the module still has ${gone}`).not.toContain(gone);
    }
    expect(ops).not.toMatch(/Import-Module|Start-Process|Invoke-Expression|powershell\.exe|ZipFile\]::/i);
    expect(ops).not.toMatch(/^\s*(?:&|\.)\s+[$'"(]/m);
  });

  it('install: the first half checks the zip, makes the locked root, unpacks the checked copy and runs the release copy, in that order, and never loads the module', () => {
    const install = code('deploy/windows/install.ps1');
    const first = functionBody(install, 'Invoke-AccucutInstallFirstHalf');
    const order = [
      'Test-AccucutScriptAdministrator',
      'Assert-AccucutTrustedRootShape -Root $Root',
      'Get-AccucutExpectedSha256 -ZipPath $ZipPath',
      'Get-AccucutTrustedSha256 -Path $ZipPath',
      'New-AccucutTrustedRoot -Root $Root',
      'Expand-AccucutTrustedPackage -Root $Root -ZipPath $ZipPath -Sha256 $expected',
      "Invoke-AccucutTrustedScript -Root $Root -Path ([System.IO.Path]::Combine($release, 'install.ps1'))",
    ];
    let position = -1;
    for (const marker of order) {
      const found = first.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    expect(first).toContain("@('-VerifiedRelease', $release)");
    expect(first).not.toMatch(/Import-|\.psm1|Invoke-Accucut(?!Trusted|InstallFirst)/);
    // On a failure the root that this run made is removed again, so the install can be run again.
    expect(first).toContain('Remove-AccucutTrustedTree -Path $Root -Within $Root -IncludeWithin');
  });

  it('install: the second half runs only as <Root>\\releases\\<tag>\\install.ps1, checks the folder chain, and only then loads the module (the only load)', () => {
    const install = code('deploy/windows/install.ps1');
    const second = functionBody(install, 'Invoke-AccucutInstallSecondHalf');
    const order = [
      'Test-AccucutScriptAdministrator',
      'Assert-AccucutSecondHalfLocation -Root $Root -VerifiedRelease $VerifiedRelease -ScriptPath $ScriptPath',
      'Assert-AccucutTrustedRootShape -Root $Root',
      'Test-AccucutInstallPresent -Root $Root',
      'Assert-AccucutTrustedPath -Path $release -Root $Root -ProtectedRoot',
      'Assert-AccucutTrustedNoLinks -Path $release',
      'Import-AccucutTrustedModule -Root $Root -Release $release',
      'Invoke-AccucutInstall -Root $Root -Release $release @InstallParameter',
    ];
    let position = -1;
    for (const marker of order) {
      const found = second.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    expect((install.match(/Import-AccucutTrustedModule -Root/g) ?? []).length).toBe(1);
    expect((install.match(/Microsoft\.PowerShell\.Core\\Import-Module/g) ?? []).length).toBe(1);
    // The entry point starts the first half, or (with -VerifiedRelease) the second half, with the script's own path; sourcing the file runs nothing.
    expect(install).toContain("if ($MyInvocation.InvocationName -ne '.') {");
    expect(install).toContain('Invoke-AccucutInstallSecondHalf -Root $Root -VerifiedRelease $VerifiedRelease -ScriptPath $PSCommandPath');
    // The install itself reads only from the release folder (no zip, no copy of a tree) and uses programs by their full path, checked, never through PATH.
    const body = functionBody(install, 'Invoke-AccucutInstall');
    expect(body).not.toContain('$ZipPath');
    expect(body).not.toContain('Copy-AccucutTree');
    expect(body).toContain("[System.IO.Path]::Combine($Release, '.env.example')");
    expect(body).toContain("[System.IO.Path]::Combine($Release, 'sql\\create-roles.psql')");
    for (const program of ['$nodeExe = Resolve-AccucutTrustedExecutable', '$psql = Resolve-AccucutTrustedExecutable', '$winsw = Resolve-AccucutTrustedExecutable']) expect(body).toContain(program);
    expect(install).not.toMatch(/Get-Command -Name (?:node|psql)/);
    expect(install).not.toMatch(/-FilePath ['"]?(?:node|psql|powershell)(?:\.exe)?['"]?(?:\s|$)/);
    expect(install).toContain("[System.IO.Path]::Combine($env:ProgramFiles, 'nodejs\\node.exe')");
  });

  it('the root is made in one call with its permissions, must not exist, and is checked exactly; only an administrator-owned, protected root is accepted', () => {
    const install = code('deploy/windows/install.ps1');
    const root = functionBody(install, 'New-AccucutTrustedRoot');
    expect(root).toContain('[System.IO.Directory]::CreateDirectory($Root, $security)');
    expect(root).toContain('$security.SetAccessRuleProtection($true, $false)');
    expect(root).toContain('$security.SetOwner($administrators)');
    expect(root).toContain('already exists');
    expect(root).toContain("never uses an existing one, empty or not");
    expect(root.indexOf('Assert-AccucutTrustedAbove -Path $driveRoot -DriveRoot')).toBeLessThan(root.indexOf('CreateDirectory($Root, $security)'));
    expect(root).toContain("$actual.Owner -eq 'S-1-5-32-544'");
    expect(root).toContain('$actual.Protected');
    expect(install).toContain("'^[A-Za-z]:\\\\[A-Za-z0-9_-]{1,32}$'");
    // No separate step sets the permissions of the root after it is made.
    expect(install).not.toMatch(/Set-Acl|SetAccessControl|icacls/i);
  });

  it('the zip is copied into the locked root, the COPY is checked with rule B and its SHA-256, and only the copy is unpacked; entries that leave the folder are refused', () => {
    const install = code('deploy/windows/install.ps1');
    const expand = functionBody(install, 'Expand-AccucutTrustedPackage');
    const order = [
      '[System.IO.FileMode]::CreateNew',
      'Assert-AccucutTrustedPath -Path $copy -Root $Root -ProtectedRoot',
      'Get-AccucutTrustedSha256 -Path $copy',
      'ZipFile]::OpenRead($copy)',
      'ExtractToFile($entry, $destination, $false)',
      '[System.IO.Directory]::Move($unpacked, $release)',
      'Assert-AccucutTrustedNoLinks -Path $release',
    ];
    let position = -1;
    for (const marker of order) {
      const found = expand.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    expect(expand).toContain('Refusing to unpack it');
    expect(expand).not.toContain('OpenRead($ZipPath');
    expect(functionBody(install, 'Get-AccucutTrustedSha256')).toContain('[System.IO.FileShare]::Read');
  });

  it('rules A and B, with the SIDs, the masks, the generic-rights mapping and the CREATOR OWNER exception, are in the block', () => {
    const block = read('deploy/windows/install.ps1').match(/# >>> ACCUCUT TRUST BLOCK v1\n[\s\S]*?# <<< ACCUCUT TRUST BLOCK v1/)?.[0] ?? '';
    for (const part of [
      "'S-1-5-32-544'", "'S-1-5-18'", "'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'", '0x1200A9', '0xD0040', '0xC0040', '0x1301BF',
      '268435456', '1073741824', '2147483648', '536870912', '0x1F01FF', '0x120116', '0x120089', '0x1200A0', "'S-1-3-0'", 'ReparsePoint', 'IsCallback', 'not understood',
    ]) {
      expect(block, part).toContain(part);
    }
    // The block itself uses no cmdlet that a loaded module could shadow (see also Trust.Tests.ps1, which checks this on the syntax tree).
    const commands = [...block.matchAll(/\b(Get-ChildItem|Get-Content|Set-Content|Get-Acl|Set-Acl|Test-Path|Join-Path|Split-Path|Remove-Item|New-Item|Copy-Item|Move-Item|Start-Process|Invoke-Expression|Write-Host|Get-Command)\b/g)].map((match) => match[1]);
    expect(commands).toEqual([]);
  });

  it('old trust helpers and ad-hoc checks are gone from every script and from the module', () => {
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1', 'deploy/windows/AccucutOps.psm1']) {
      const text = code(path);
      for (const gone of ['Assert-AccucutPathTrusted', 'Get-AccucutPathSecurity', 'Assert-AccucutInstallTrusted', 'Initialize-AccucutVerifiedRelease', 'Start-AccucutInstall', 'Import-AccucutVerifiedModule', 'Assert-AccucutUpdateRunsFromInstall']) {
        expect(text, `${path} still has ${gone}`).not.toContain(gone);
      }
    }
  });

  it('every script in deploy/windows that loads or runs code carries the identical trust block; every other script has no load site (Amendment 2.1, test 3)', () => {
    const pattern = /# >>> ACCUCUT TRUST BLOCK v1\n[\s\S]*?# <<< ACCUCUT TRUST BLOCK v1/;
    const reference = read('deploy/windows/install.ps1').match(pattern)?.[0] ?? '';
    const files = readdirSync(fileURLToPath(new URL('../../deploy/windows', import.meta.url))).filter((name) => /\.(ps1|psm1)$/.test(name));
    expect(files).toEqual(expect.arrayContaining(['install.ps1', 'update.ps1', 'backup.ps1', 'clear-copies.ps1', 'AccucutOps.psm1']));
    expect(files).not.toContain('clean-logs.ps1');
    for (const name of files) {
      const source = code('deploy/windows/' + name);
      const loads = /Import-Module|Import-AccucutTrustedModule|Invoke-AccucutTrustedScript|Start-Process|Invoke-Expression|Process\]::Start|^\s*(?:&|\.)\s+[$'"(]/m.test(source);
      const text = read('deploy/windows/' + name);
      if (loads) expect(text.match(pattern)?.[0], name + ' loads or runs code, so it carries the block').toBe(reference);
      else expect(text, name + ' has no load site and needs no block').not.toContain('ACCUCUT TRUST BLOCK');
    }
  });

  it('the worker prunes the logs: there is no clean-logs.ps1, no scheduled task, no LOCAL SERVICE entry, and exactly the four entries of Amendment 2.1', () => {
    expect(() => readFileSync(fileURLToPath(new URL('../../deploy/windows/clean-logs.ps1', import.meta.url)))).toThrow();
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1', 'deploy/windows/backup.ps1', 'deploy/windows/clear-copies.ps1', 'deploy/windows/ci/assert-install.ps1', 'scripts/package-windows.ps1']) {
      const source = code(path);
      expect(source, path + ' registers a task or names clean-logs').not.toMatch(/Register-ScheduledTask|New-ScheduledTask|schtasks|clean-logs/);
      if (path !== 'deploy/windows/ci/assert-install.ps1') expect(source, path + ' names a shared account').not.toMatch(/S-1-5-19|LOCAL SERVICE/);
    }
    // The module registers one task only: the weekly backup (Amendment 3), inside Register-AccucutBackupTask, and names no shared account.
    const moduleCode = code('deploy/windows/AccucutOps.psm1');
    expect(moduleCode).not.toMatch(/schtasks|clean-logs|S-1-5-19|LOCAL SERVICE|NETWORK SERVICE|S-1-5-20/);
    expect(functionBody(moduleCode, 'Register-AccucutBackupTask')).toContain('Register-ScheduledTask -TaskName $script:BackupTaskName');
    expect((moduleCode.match(/Register-ScheduledTask/g) ?? []).length).toBe(1);
    // The only entries: Administrators and SYSTEM (made with the root), then Read and execute on the root and Modify on logs for the two service SIDs.
    const grant = functionBody(code('deploy/windows/AccucutOps.psm1'), 'Grant-AccucutInstallFolderAccess');
    expect(grant).toContain('Grant-AccucutFolderAccess -Path $Paths.Root -Account $account -Rights ReadAndExecute');
    expect(grant).toContain('Grant-AccucutFolderAccess -Path $Paths.Logs -Account $account -Rights Modify');
    expect((grant.match(/Grant-AccucutFolderAccess/g) ?? []).length).toBe(2);
    expect(code('deploy/windows/install.ps1')).toContain('Grant-AccucutInstallFolderAccess -Paths $paths -ServiceSid $accounts');
    expect((code('deploy/windows/install.ps1').match(/Grant-AccucutFolderAccess/g) ?? []).length).toBe(0);
    // update.ps1 lets the two service accounts write in logs when it checks it (rule B, -Writer), and nobody else.
    expect(code('deploy/windows/update.ps1')).toMatch(/Combine\(\$Root, 'logs'\)\) -Root \$Root -ProtectedRoot -Writer @\(\(Get-AccucutUpdateServiceSid -Name 'AccucutApp'\), \(Get-AccucutUpdateServiceSid -Name 'AccucutWorker'\)\)/);
    // assert-install.ps1 checks the exact entries and that no task exists.
    const assertInstall = code('deploy/windows/ci/assert-install.ps1');
    for (const part of ['Get-AceList', '0x1F01FF|False|3|Allow', '0x1200A9|False|3|Allow', '0x1301BF|False|3|Allow', "'S-1-5-19', 'S-1-5-20', 'S-1-5-11', 'S-1-5-32-545', 'S-1-1-0'", "Get-ScheduledTask -TaskName 'Accucut log cleanup'"]) {
      expect(assertInstall, part).toContain(part);
    }
    // The install tells the worker which folder to prune, as an absolute path with forward slashes, and the worker runs the job.
    expect(code('deploy/windows/install.ps1')).toContain("\"LOG_DIRECTORY=$($paths.Logs.Replace('\\', '/'))\"");
    const worker = read('src/worker/main.ts');
    expect(worker).toContain("import { scheduleLogPrune } from '../server/jobs/log-prune';");
    expect(worker).toContain('scheduleLogPrune(process.env.LOG_DIRECTORY, log)');
    const job = read('src/server/jobs/log-prune.ts');
    expect(job).toContain("export const LOG_PRUNE_CRON = '30 3 * * *';");
    expect(job).toContain("export const LOG_PRUNE_TIMEZONE = 'Asia/Kolkata';");
    const jobCode = job
      .split('\n')
      .filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line))
      .join('\n');
    expect(jobCode).not.toMatch(/job_runs|jobRuns|readFile|createReadStream/);
  });

  it('install and update logs are new files with unpredictable names, created with CreateNew and held open; nothing appends to a log (review SQR-03)', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    expect(ops).not.toMatch(/Add-Content|Out-File|Set-Content/);
    const log = functionBody(ops, 'Write-AccucutLog');
    expect(log).toContain('[System.IO.FileMode]::CreateNew');
    expect(log).toContain('[System.IO.FileShare]::Read');
    expect(log).toContain('already exists');
    expect(functionBody(ops, 'New-AccucutLogFileName')).toContain('[guid]::NewGuid()');
    expect(code('deploy/windows/install.ps1')).toContain("(New-AccucutLogFileName -Prefix 'install')");
    expect(code('deploy/windows/update.ps1')).toContain("(New-AccucutLogFileName -Prefix 'update')");
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1']) expect(code(path)).not.toMatch(/Add-Content|Out-File|\.log"/);
    // The root is removed only after the open log was closed and copied.
    const remove = functionBody(code('deploy/windows/install.ps1'), 'Remove-AccucutInstallRoot');
    expect(remove.indexOf('Close-AccucutLog')).toBeGreaterThan(0);
    expect(remove.indexOf('Close-AccucutLog')).toBeLessThan(remove.indexOf('[System.IO.File]::Copy($LogFile'));
    expect(remove.indexOf('[System.IO.File]::Copy($LogFile')).toBeLessThan(remove.indexOf('Remove-AccucutTrustedTree'));
  });

  it('update: every step from the junction switch to the health check is inside the rollback, which has its own try for each step and ends in "Call your IT person" (review SQR-02, SQR-09)', () => {
    const update = code('deploy/windows/update.ps1');
    const body = functionBody(update, 'Invoke-AccucutUpdate');
    const order = [
      '$exeSnapshot[$name] = [System.IO.File]::ReadAllBytes(',
      'Stop-AccucutServices',
      '$healthy = $false',
      'try {\n        Set-AccucutCurrentRelease -Paths $paths -Tag $newTag',
      'Initialize-AccucutServiceFiles',
      'Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($paths.Services, "$name.exe"))',
      'Update-AccucutServiceProgram -Paths $paths -Name @($changed)',
      '$healthy = Start-AccucutServicesAndCheck',
      'catch {\n        Invoke-AccucutRollback',
      'if (-not $healthy) {\n        Invoke-AccucutRollback',
      'Remove-AccucutOldReleases',
    ];
    let position = -1;
    for (const marker of order) {
      const found = body.indexOf(marker, position + 1);
      expect(found, marker + ' is missing or out of order').toBeGreaterThan(position);
      position = found;
    }
    const rollback = functionBody(update, 'Invoke-AccucutRollback');
    expect((rollback.match(/^\s*try \{/gm) ?? []).length).toBeGreaterThanOrEqual(4);
    for (const step of ['Stop-AccucutServices', 'Set-AccucutCurrentRelease -Paths $Paths -Tag $OldTag', 'Restore-AccucutServiceFiles -Paths $Paths -Snapshot $Snapshot -ExeSnapshot $ExeSnapshot', 'Start-AccucutServicesAndCheck']) {
      expect(rollback, step).toContain(step);
    }
    expect(rollback).toContain('Call your IT person');
    expect(rollback.trimEnd().endsWith('}')).toBe(true);
    // The WinSW programs are restored byte for byte, and each is trust-checked before the refresh.
    const restore = functionBody(update, 'Restore-AccucutServiceFiles');
    expect(restore.indexOf('WriteAllBytes($exe')).toBeGreaterThan(0);
    expect(restore.indexOf('Resolve-AccucutTrustedExecutable -Path $exe')).toBeGreaterThan(restore.indexOf('WriteAllBytes($exe'));
    expect(restore.indexOf('Update-AccucutServiceProgram')).toBeGreaterThan(restore.indexOf('Resolve-AccucutTrustedExecutable -Path $exe'));
  });

  it('the security of a path is read as attributes, descriptor, attributes again, and a difference is refused; Get-Item is used in one place (Amendment 2.1)', () => {
    const install = code('deploy/windows/install.ps1');
    const security = functionBody(install, 'Get-AccucutTrustSecurity');
    expect((security.match(/Get-AccucutTrustAttributes -Path \$Path/g) ?? []).length).toBe(2);
    expect(security.indexOf('Get-AccucutTrustAttributes')).toBeLessThan(security.indexOf('GetAccessControl'));
    expect(security.indexOf('GetAccessControl')).toBeLessThan(security.lastIndexOf('Get-AccucutTrustAttributes'));
    expect(security).toContain('changed while its permissions were being read');
    expect(functionBody(install, 'Get-AccucutTrustAttributes')).toContain('[System.IO.File]::GetAttributes($Path)');
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1']) {
      const text = code(path);
      expect((text.match(/Get-Item\b/g) ?? []).length).toBe(1);
      expect(functionBody(text, 'Get-AccucutTrustedCurrent')).toContain('Microsoft.PowerShell.Management\\Get-Item -LiteralPath $current -Force');
    }
  });

  it('the second half of the install refuses an existing install and never removes one; programs are checked before each run (review SQR-05, SQR-06)', () => {
    const install = code('deploy/windows/install.ps1');
    const present = functionBody(install, 'Test-AccucutInstallPresent');
    expect(present).toContain("[System.IO.Path]::Combine($Root, 'config')");
    expect(present).toContain('install-state.json');
    const body = functionBody(install, 'Invoke-AccucutInstall');
    // node, psql and WinSW are resolved (trust-checked) in the text before the first call that runs them.
    expect(body.indexOf('$nodeExe = Resolve-AccucutTrustedExecutable')).toBeLessThan(body.indexOf('Invoke-AccucutNative -FilePath $nodeExe'));
    expect(body.indexOf('$psql = Resolve-AccucutTrustedExecutable')).toBeLessThan(body.indexOf('Invoke-AccucutNative -FilePath $psql'));
    expect(body.indexOf('$winsw = Resolve-AccucutTrustedExecutable')).toBeLessThan(body.indexOf('Invoke-AccucutNative -FilePath $winsw'));
    expect(body.indexOf('$nodeExe = Resolve-AccucutTrustedExecutable')).toBeLessThan(body.indexOf('Invoke-AccucutMigration'));
    const update = code('deploy/windows/update.ps1');
    const updateBody = functionBody(update, 'Invoke-AccucutUpdate');
    expect(updateBody.indexOf('$nodeExe = Resolve-AccucutTrustedExecutable')).toBeLessThan(updateBody.indexOf('Invoke-AccucutMigration'));
    expect(functionBody(update, 'Update-AccucutServiceProgram').indexOf('Resolve-AccucutTrustedExecutable')).toBeLessThan(functionBody(update, 'Update-AccucutServiceProgram').indexOf('Invoke-AccucutNative -FilePath $winsw'));
  });

  it('both READMEs: unpack into an administrator-only folder (never under C:\\), and every install or update command shows -Sha256 (review SQR-04, R-T1)', () => {
    for (const path of ['README.md', 'deploy/windows/README.md']) {
      const text = read(path);
      expect(text, path + ' tells IT to unpack under C:\\').not.toMatch(/C:\\accucut-pkg/i);
      const commands = text.split('\n').filter((line) => /(?:^|[\s\x60])\.\\(?:install|update)\.ps1 /.test(line) || /^\s*\x60?\.\\(?:install|update)\.ps1/.test(line));
      expect(commands.length, path + ' shows no install or update command').toBeGreaterThan(0);
      for (const line of commands) expect(line, path + ': ' + line).toContain('-Sha256');
    }
    expect(read('README.md')).toContain('C:\\Program Files\\accucut-pkg');
    expect(read('deploy/windows/README.md')).toContain('C:\\Program Files\\accucut-pkg');
  });

  it('settings files: locked before they are filled', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    expect(ops.indexOf('WriteAllBytes($Path')).toBeLessThan(ops.indexOf('Set-AccucutFileAcl -Path $Path'));
    expect(ops.indexOf('Set-AccucutFileAcl -Path $Path')).toBeLessThan(ops.indexOf('WriteAllText($Path'));
  });

  it('update: runs only as the installed update.ps1, checks the whole chain before the module is loaded, takes the backup before it stops anything, and rolls the junction back on a failed health check', () => {
    const update = code('deploy/windows/update.ps1');
    const environment = functionBody(update, 'Import-AccucutUpdateEnvironment');
    const checks = [
      'Test-AccucutScriptAdministrator',
      'Assert-AccucutTrustedRootShape -Root $Root',
      'Get-AccucutTrustedCurrent -Root $Root',
      "'current\\update.ps1'",
      'Assert-AccucutTrustedPath -Path $old -Root $Root -ProtectedRoot',
      "Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($old, 'AccucutOps.psm1')) -Root $Root -ProtectedRoot",
      "Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($Root, 'config'))",
      "Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($Root, 'services'))",
      "Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($Root, 'logs'))",
      'Assert-AccucutTrustedNoLinks -Path $old',
      'Import-AccucutTrustedModule -Root $Root -Release $old',
    ];
    let position = -1;
    for (const marker of checks) {
      const found = environment.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    expect((update.match(/Import-AccucutTrustedModule -Root/g) ?? []).length).toBe(1);
    expect(update.indexOf('$oldRelease = Import-AccucutUpdateEnvironment')).toBeLessThan(update.indexOf('Invoke-AccucutUpdate -ZipPath $ZipPath'));
    expect(update).toContain("if ($MyInvocation.InvocationName -ne '.') {");

    const body = functionBody(update, 'Invoke-AccucutUpdate');
    const order = [
      'Get-AccucutTrustedSha256 -Path $ZipPath',
      'Invoke-AccucutReleaseBackup -Root $Root -OldRelease $OldRelease',
      'Expand-AccucutTrustedPackage -Root $Root -ZipPath $ZipPath -Sha256 $expected -RefuseTag $oldTag -ReplaceExisting',
      'Stop-AccucutServices',
      'Assert-AccucutTrustedPath -Path $target -Root $Root -ProtectedRoot',
      'Assert-AccucutTrustedNoLinks -Path $target',
      '$nodeExe = Resolve-AccucutTrustedExecutable',
      'Invoke-AccucutMigration -ReleaseDirectory $target',
      'Set-AccucutCurrentRelease -Paths $paths -Tag $newTag',
      '[void](Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($paths.Services, "$name.exe")))',
      'Start-AccucutServicesAndCheck',
    ];
    let place = -1;
    for (const marker of order) {
      const found = body.indexOf(marker, place + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(place);
      place = found;
    }
    expect(body).toContain('Call your IT person');
    expect(body).toMatch(/Remove-AccucutOldReleases -Paths \$paths -Keep @\(\$newTag, \$oldTag\)/);
    expect(body).not.toContain('Copy-Item');
    // The new release's scripts are never run by an update; the backup script is the running release's own, through the checked wrapper.
    expect(update).not.toMatch(/Invoke-AccucutTrustedScript -Root \$Root -Path \$target/);
    expect(functionBody(update, 'Invoke-AccucutReleaseBackup')).toContain('Invoke-AccucutTrustedScript -Root $Root -Path $script');
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

  it('keeps one SQL source of the three roles, which the development database and the Windows install both read', () => {
    expect(read('deploy/db/create-roles.psql')).toContain('CREATE ROLE accucut_owner LOGIN PASSWORD');
    expect(read('deploy/db/create-roles.psql')).toContain('GRANT pg_read_all_data TO accucut_backup;');
    expect(read('docker/postgres-init/01-create-roles.sh')).toContain('--file "$roles_sql"');
    expect(read('deploy/windows/install.ps1')).toContain("sql\\create-roles.psql");
    expect(read('scripts/package-windows.ps1')).toContain('deploy\\db\\create-roles.psql');
  });
});

describe('STORY-10.05: the weekly backup, the watch and the clear on Windows (ADR-015 Amendment 3), static guards', () => {
  it('the package carries backup.ps1 and clear-copies.ps1 next to install.ps1 and update.ps1', () => {
    const pack = read('scripts/package-windows.ps1');
    expect(pack).toContain("'install.ps1', 'update.ps1', 'backup.ps1', 'clear-copies.ps1', 'AccucutOps.psm1'");
  });

  it('install: the backup account and task come first, then the entries that name the account, then the services; the first backup runs after the state file is written; the password is never logged', () => {
    const install = code('deploy/windows/install.ps1');
    const body = functionBody(install, 'Invoke-AccucutInstall');
    const order = [
      '$powershellExe = Resolve-AccucutTrustedExecutable',
      '[void](Register-AccucutEventSource)',
      '$backupSid = Register-AccucutBackupTask -Paths $paths -PowerShellPath $powershellExe',
      '$created.BackupAccount = $true',
      'Grant-AccucutBackupRootAccess -Paths $paths -BackupSid $backupSid',
      'New-AccucutBackupFolder -Path $paths.Backups -BackupSid $backupSid',
      'Write-AccucutBackupConfig -Paths $paths -BackupSid $backupSid -BackupPassword $settings.BackupPassword',
      '[void](Initialize-AccucutServiceFiles',
      'Grant-AccucutInstallFolderAccess -Paths $paths -ServiceSid $accounts',
      'Start-AccucutServices',
      '[System.IO.File]::WriteAllText($paths.StateFile',
      'Invoke-AccucutFirstBackup -PsqlPath $psql -Connection $connection -LogFile $logFile',
    ];
    let position = -1;
    for (const marker of order) {
      const found = body.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    // The role's password: invented once, given to the role SQL through the environment and to the settings writer, and to nothing that logs or runs a program.
    expect(body).toContain('DB_BACKUP_PASSWORD = $settings.BackupPassword');
    for (const line of body.split('\n').filter((entry) => /Write-AccucutLog|Write-Host|Invoke-AccucutNative|Set-Content|Out-File/.test(entry))) {
      expect(line, line).not.toMatch(/BackupPassword|backupPassword/);
    }
    // The first backup waits for the task for at most 5 minutes, and says what to do when the batch-logon right is missing.
    const first = functionBody(install, 'Invoke-AccucutFirstBackup');
    expect(first).toContain('Wait-AccucutBackupTask -TimeoutSeconds 300');
    expect(first).toContain("Windows refused the logon of AccucutBackup ('Log on as a batch job'; Security log event 4625, status 0xC000015B)");
    expect(first).toContain("Start-ScheduledTask 'Accucut weekly backup'");
    expect(first).toContain('Test-AccucutLogonTypeFailure -TaskResult $result');
    expect(first).toContain("result->>'status' = 'ok'");
    // A failure that happens before the services are registered removes the account and the task too, and only when this run made them.
    expect(body).toContain('if ($created.BackupAccount) {');
    expect(body.indexOf('Remove-AccucutBackupAccount')).toBeGreaterThan(body.indexOf('INSTALL FAILED'));
    // The recipient is a public key, from the values file or a question; it never goes to .env.
    const settings = functionBody(install, 'Get-AccucutInstallSettings');
    expect(settings).toContain("-Name 'BACKUP_AGE_RECIPIENT'");
    expect(settings).toContain("'^age1[0-9a-z]{58}$'");
    expect(settings).not.toContain("$values['BACKUP_AGE_RECIPIENT']");
    // .env tells the worker which drive roots to measure (forward slashes, like LOG_DIRECTORY).
    expect(body).toContain('"BACKUP_VOLUME=$backupVolume"');
    expect(body).toContain('"PG_DATA_VOLUME=$dataVolume"');
  });

  it('backup.ps1 and clear-copies.ps1: no parameter that moves the root, the folder or a program; checks before work; every program by full path; exit code 1 on any failure', () => {
    for (const name of ['backup.ps1', 'clear-copies.ps1']) {
      const text = code(`deploy/windows/${name}`);
      const source = read(`deploy/windows/${name}`);
      expect(text, name).not.toMatch(/Read-Host|Add-Content|Out-File|Set-Content|PGPASSWORD|AGE-SECRET-KEY|Start-Process|Invoke-Expression/);
      expect(text, name).toContain("if ($MyInvocation.InvocationName -ne '.') {");
      expect(text, name).toContain('exit 0');
      expect(text, name).toContain('exit 1');
      expect(text, name).toContain('Hide-AccucutSecrets');
      // Everything that is run comes through Resolve-AccucutTrustedExecutable; nothing is looked up through PATH.
      expect(text, name).not.toMatch(/Get-Command -Name (?!Hide-AccucutSecrets)/);
      expect(text, name).not.toMatch(/-FilePath|Process\]::Start\(\$[a-z]*Info/);
      expect(source.match(/^\[CmdletBinding\(\)\]\r?\nparam\(([\s\S]*?)\r?\n\)/m)?.[1] ?? '').toBe(name === 'backup.ps1' ? "\n    [ValidateSet('weekly', 'release')][string]$Reason = 'weekly'" : '');
    }
    const backup = functionBody(code('deploy/windows/backup.ps1'), 'Invoke-AccucutBackupScript');
    expect((backup.match(/Resolve-AccucutTrustedExecutable/g) ?? []).length).toBe(3);
    expect(backup).toContain("[System.IO.Path]::Combine($release, 'bin\\age.exe')");
    // One Application event per run (ADR-015 Amendment 3.1 point 5), never a log file: AccucutBackup has no right on logs.
    expect(backup).toContain("Write-AccucutBackupEvent -EntryType Information -EventId 1000");
    expect(backup).toContain('Write-AccucutBackupEvent -EntryType Error -EventId $eventId');
    expect(code('deploy/windows/backup.ps1')).toContain("[System.Diagnostics.EventLog]::WriteEntry('Accucut', $text,");
    expect(backup).toContain("[System.IO.Path]::Combine($settings.PgBinDirectory, 'pg_dump.exe')");
    expect(backup).toContain("[System.IO.Path]::Combine($settings.PgBinDirectory, 'psql.exe')");
    const folder = functionBody(code('deploy/windows/backup.ps1'), 'Assert-AccucutBackupFolderTrusted');
    expect(folder).toContain('Assert-AccucutTrustedPath -Path $Directory -Root $Root -ProtectedRoot -Writer @($BackupSid)');
    expect(folder).toContain("'S-1-5-32-544'");
    expect(folder).toContain('$security.Protected');
  });

  it('the backup run writes only with CreateNew, deletes only through the proving functions, and keeps secrets off command lines and out of logs', () => {
    const ops = code('deploy/windows/AccucutOps.psm1');
    // (code() drops comment lines, so the region starts at its first constant.)
    const region = ops.slice(ops.indexOf('$script:BackupAccountName ='));
    expect(region).not.toMatch(/PGPASSWORD|--password|AGE-SECRET-KEY|Out-File|Add-Content|Set-Content|Remove-Item|Directory\]::Delete|-Recurse|Get-ChildItem|Start-Process/);
    expect(region).not.toMatch(/FileName = .*cmd/);
    expect(region).toContain("'PGPASSFILE'");
    expect(region).toMatch(/KeepFreeFraction = 0\.20/);
    expect(region).toMatch(/BackupKeepNewest = 4/);
    expect(region).toMatch(/BackupRetentionYears = 2/);
    expect(region).toContain("'^accucut-(\\d{8})-(\\d{6})-(weekly|release)\\.age$'");
    // The program that is run for the dump and the encryption is started with redirected streams and both exit codes are read.
    const pipe = functionBody(region, 'Invoke-AccucutBackupPipe');
    expect(pipe).toContain('$dumpCode = $dump.ExitCode');
    expect(pipe).toContain('$ageCode = $age.ExitCode');
    expect(pipe).toContain('[System.IO.FileMode]::CreateNew');
    expect(pipe).toContain('BaseStream');
    expect(pipe).toContain('$source.CopyTo($sink)');
    expect(pipe).toContain('$script:AgeHeader');
    expect(pipe).not.toMatch(/FileName\s*=.*cmd/i);
    expect(pipe).not.toMatch(/\|\s*Out-|Get-Content|ConvertTo-Json|Write-Output/);
    // job_runs: INSERT only, as accucut_backup, values quoted by psql.
    const row = functionBody(region, 'Add-AccucutJobRun');
    expect(row).toContain("INSERT INTO job_runs (job, started_at, finished_at, result) VALUES (:'job', :'started'::timestamptz, :'finished'::timestamptz, :'result'::jsonb);");
    expect(row).not.toMatch(/UPDATE|DELETE|SELECT/);
    expect(row).toContain('$script:BackupDatabaseRole');
  });

  it('stage 13 makes a throwaway age key, gives the install the public half, asserts the backup and exercises it on the real install, and deletes the private key', () => {
    expect(WORKFLOW).toContain('Make a throwaway age key pair for the backups of this run');
    expect(WORKFLOW).toContain('age-keygen.exe');
    expect(WORKFLOW).toContain('"BACKUP_AGE_RECIPIENT=$($env:ACCUCUT_AGE_PUBLIC)"');
    expect(WORKFLOW).toContain("Write-Host \"::add-mask::$($line.Trim())\"");
    expect(WORKFLOW).toContain('Exercise backup.ps1 and clear-copies.ps1 on the real install');
    expect(WORKFLOW).toContain('exercise-backup.ps1 -ValuesFile $env:ACCUCUT_VALUES -MarkerFile $marker');
    expect(WORKFLOW).toContain('Remove-Item -LiteralPath $env:ACCUCUT_AGE_KEY -Force');
    // The key is made before the PostgreSQL step that writes the values file, and the exercise runs after the install is asserted and before the update.
    const order = ['Make a throwaway age key pair', 'Start PostgreSQL 17 and change its administrator password', 'Install from the unpacked zip', 'Assert the install', 'Exercise backup.ps1 and clear-copies.ps1', 'Update to the second release'];
    let position = -1;
    for (const marker of order) {
      const found = WORKFLOW.indexOf(marker, position + 1);
      expect(found, `${marker} is missing or out of order`).toBeGreaterThan(position);
      position = found;
    }
    // Every assert-install call gets the key file, and the updates run with the real release backup (no -NoBackup).
    const calls = [...WORKFLOW.matchAll(/assert-install\.ps1 [^\n]*/g)].map((match) => match[0]);
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const call of calls) expect(call).toContain('-AgeKeyFile $env:ACCUCUT_AGE_KEY');
    expect(WORKFLOW).not.toContain('-NoBackup');
    // No private key or password is written into the workflow.
    expect(WORKFLOW).not.toMatch(/AGE-SECRET-KEY-1[A-Z0-9]{20,}/);
    // The change is limited to this workflow: the required check is untouched.
    expect(CI).toMatch(/needs: \[verify, e2e\]/);
  });

  it('ADR-015 Amendment 3.2: the install gives "Log on as a batch job" to the new SID alone, with the LSA calls made in memory, never with a program, Add-Type or secedit', () => {
    const files = readdirSync(fileURLToPath(new URL('../../deploy/windows', import.meta.url))).filter((name) => /\.(ps1|psm1)$/.test(name));
    for (const name of files) expect(code('deploy/windows/' + name), name + ' uses Add-Type').not.toMatch(/Add-Type/i);
    const ops = code('deploy/windows/AccucutOps.psm1');
    expect(ops).not.toMatch(/secedit|\bntrights\b|gpupdate\.exe|csc\.exe|OutputAssembly|CodeDom/i);
    expect((ops.match(/DefineDynamicAssembly/g) ?? []).length).toBe(1);
    expect((ops.match(/DefinePInvokeMethod/g) ?? []).length).toBe(1);
    expect([...ops.matchAll(/[\w-]+\.dll/gi)].map((match) => match[0].toLowerCase())).toEqual(['advapi32.dll']);
    const native = functionBody(ops, 'Get-AccucutLsaNative');
    expect(native).toContain('DefineDynamicAssembly');
    expect(native).toContain('[System.Environment]::Is64BitProcess');
    expect([...native.matchAll(/Name = '(Lsa\w+)'/g)].map((match) => match[1])).toEqual([
      'LsaOpenPolicy', 'LsaAddAccountRights', 'LsaRemoveAccountRights', 'LsaEnumerateAccountsWithUserRight', 'LsaFreeMemory', 'LsaClose', 'LsaNtStatusToWinError',
    ]);
    // The policy is opened with 0x811 and never with all access; the revoke never removes every right of the account.
    expect(functionBody(ops, 'Open-AccucutLsaPolicy')).toContain('[uint32]0x811');
    expect(ops).not.toMatch(/0xF0FFF|POLICY_ALL_ACCESS|983551/);
    expect(functionBody(ops, 'Remove-AccucutLsaHolder')).toContain('(Get-AccucutSidBytes -Sid $Sid), [byte]0, $name.Structure');
    // No -Right parameter on the grant: this module can give this one right and no other.
    const grant = functionBody(ops, 'Grant-AccucutBatchLogonRight');
    expect(grant).not.toMatch(/\[string\]\$Right|\$Right\b(?!s)/);
    expect(grant).toContain("$right = 'SeBatchLogonRight'");
    // The install order: user, then the right, then the task; the right goes before the user on removal.
    const register = functionBody(ops, 'Register-AccucutBackupTask');
    expect(register.indexOf('New-LocalUser')).toBeLessThan(register.indexOf('Grant-AccucutBatchLogonRight -Sid $user.SID.Value'));
    expect(register.indexOf('Grant-AccucutBatchLogonRight -Sid $user.SID.Value')).toBeLessThan(register.indexOf('Register-ScheduledTask'));
    const remove = functionBody(ops, 'Remove-AccucutBackupAccount');
    expect(remove.indexOf('Unregister-ScheduledTask')).toBeLessThan(remove.indexOf('Revoke-AccucutBatchLogonRight'));
    expect(remove.indexOf('Revoke-AccucutBatchLogonRight')).toBeLessThan(remove.indexOf('Remove-LocalUser'));
    // The policy check is the first thing the install does with the backup account's right, and before anything is created; update.ps1 only looks.
    const installBody = functionBody(code('deploy/windows/install.ps1'), 'Invoke-AccucutInstall');
    expect(installBody.indexOf('Test-AccucutBatchRightPolicy -PolicyConfirmed:$BatchRightPolicyConfirmed')).toBeGreaterThan(0);
    expect(installBody.indexOf('Test-AccucutBatchRightPolicy')).toBeLessThan(installBody.indexOf('Write-AccucutSecureFile'));
    expect(installBody.indexOf('Test-AccucutBatchRightPolicy')).toBeLessThan(installBody.indexOf('CREATE DATABASE'));
    expect(code('deploy/windows/install.ps1')).toContain('[switch]$BatchRightPolicyConfirmed');
    const update = code('deploy/windows/update.ps1');
    expect(update).not.toMatch(/Grant-AccucutBatchLogonRight|Revoke-AccucutBatchLogonRight/);
    expect(functionBody(update, 'Write-AccucutBatchRightWarning')).toContain("Get-AccucutRightHolder -Right 'SeBatchLogonRight'");
  });

  it('assert-install checks, on the real install, the account, the task, the exact entries, the first backup, a restore and what the backup role can and cannot do', () => {
    const assertInstall = code('deploy/windows/ci/assert-install.ps1');
    for (const part of [
      "Get-LocalUser -Name 'AccucutBackup'",
      '$null -eq $backupUser.PasswordExpires',
      '-not $backupUser.UserMayChangePassword',
      'is an explicit member of no local group',
      "Get-ScheduledTask -TaskName 'Accucut weekly backup'",
      "[string]$task.Principal.LogonType -eq 'Password'",
      "[string]$task.Principal.RunLevel -eq 'Limited'",
      'MSFT_TaskWeeklyTrigger',
      '[int]$task.Triggers[0].DaysOfWeek -eq 1',
      "'-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"' + (Join-Path $paths.Current 'backup.ps1') + '\" -Reason weekly'",
      '"$backupSid|0x1200A9|False|3|Allow"',
      '"$backupSid|0x1301BF|False|3|Allow"',
      '"$backupSid|0x120089|False|0|Allow"',
      '[uint32]$taskInfo.LastTaskResult -eq 0',
      "ProviderName = 'Accucut'; Id = 1000",
      'rolcanlogin',
      "result->>'status' = 'ok'",
      'pg_restore.exe',
      "pg_has_role('accucut_backup', 'pg_read_all_data', 'member')",
      'accucut_backup can INSERT into job_runs',
      'UPDATE on job_runs',
      'DELETE on job_runs',
      'INSERT into another table',
      'CREATE TABLE',
      'does not name AccucutBackup',
    ]) {
      expect(assertInstall, part).toContain(part);
    }
    // The root has five entries, the logs folder six inherited-or-explicit ones plus two: seven entries in all.
    expect(assertInstall).toMatch(/the install folder holds exactly five entries/);
    expect(assertInstall).toContain("'S-1-5-19', 'S-1-5-20', 'S-1-5-11', 'S-1-5-32-545', 'S-1-1-0'");
  });

  it('exercise-backup.ps1 runs a release backup, more copies, a clear with a wrong then the right date, planted things that are not the backup\'s own, and a replaced module', () => {
    const exercise = code('deploy/windows/ci/exercise-backup.ps1');
    for (const part of [
      "-Argument @('-Reason', 'release')",
      "-Name 'clear-copies.ps1' -Answer @('1999-01-01')",
      "-Answer @('yesterday')",
      '-Answer @($today, \'no\')',
      '-Answer @($today, \'YES\')',
      'mklink /J',
      "accucut-20200101-000000-weekly.age",
      '/grant \'*S-1-5-32-545:(W)\'',
      '/remove:g \'*S-1-5-32-545\'',
      'can be changed by S-1-5-32-545',
      'the tampered module was never loaded by',
      'the module was put back byte for byte',
    ]) {
      expect(exercise, part).toContain(part);
    }
    expect(exercise).toMatch(/finally \{[^}]*WriteAllBytes\(\$module, \$originalBytes\)[^}]*icacls\.exe[^}]*\/remove:g/);
  });
});
