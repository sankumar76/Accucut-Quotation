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

  it('the trust block (ADR-015 Amendment 2) is one copy, byte for byte the same in install.ps1 and update.ps1, and nowhere else', () => {
    const install = read('deploy/windows/install.ps1');
    const update = read('deploy/windows/update.ps1');
    const pattern = /# >>> ACCUCUT TRUST BLOCK v1\n[\s\S]*?# <<< ACCUCUT TRUST BLOCK v1/;
    for (const text of [install, update]) {
      expect((text.match(/# >>> ACCUCUT TRUST BLOCK v1/g) ?? []).length).toBe(1);
      expect((text.match(/# <<< ACCUCUT TRUST BLOCK v1/g) ?? []).length).toBe(1);
    }
    const block = install.match(pattern)?.[0] ?? '';
    expect(block.length).toBeGreaterThan(10_000);
    expect(update.match(pattern)?.[0]).toBe(block);
    // The block defines its 18 functions, and none of them is defined outside it (in a script or in the module).
    const names = [...block.matchAll(/^function ([\w-]+) \{$/gm)].map((match) => match[1] ?? '');
    expect(names).toHaveLength(19);
    for (const path of ['deploy/windows/install.ps1', 'deploy/windows/update.ps1', 'deploy/windows/AccucutOps.psm1']) {
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
    expect(files).toEqual(expect.arrayContaining(['install.ps1', 'update.ps1', 'clean-logs.ps1', 'AccucutOps.psm1']));
    for (const name of files) {
      const source = code('deploy/windows/' + name);
      const loads = /Import-Module|Import-AccucutTrustedModule|Invoke-AccucutTrustedScript|Start-Process|Invoke-Expression|Process\]::Start|^\s*(?:&|\.)\s+[$'"(]/m.test(source);
      const text = read('deploy/windows/' + name);
      if (loads) expect(text.match(pattern)?.[0], name + ' loads or runs code, so it carries the block').toBe(reference);
      else expect(text, name + ' has no load site and needs no block').not.toContain('ACCUCUT TRUST BLOCK');
    }
  });

  it('clean-logs.ps1 is self-contained (.NET only, no import, no other script), and its task runs as LOCAL SERVICE, not SYSTEM and not elevated', () => {
    const clean = code('deploy/windows/clean-logs.ps1');
    expect(clean).not.toMatch(/Import-Module|AccucutOps|Start-Process|Invoke-Expression|^\s*(?:&|\.)\s+[$'"(]/m);
    expect(clean).toContain('[System.IO.Directory]::GetFiles($LogDirectory, \'*.log\')');
    expect(clean).toContain('ReparsePoint');
    const install = code('deploy/windows/install.ps1');
    const task = functionBody(install, 'Register-AccucutLogCleanupTask');
    expect(task).toContain("-UserId 'NT AUTHORITY\\LOCAL SERVICE' -LogonType ServiceAccount");
    expect(task).not.toMatch(/SYSTEM'|RunLevel Highest/);
    expect(install).toContain("$script:AccucutLogCleanupSid = 'S-1-5-19'");
    expect(install).toContain('Grant-AccucutFolderAccess -Path $paths.Logs -Account $script:AccucutLogCleanupSid -Rights Modify');
    expect(install).toContain('Grant-AccucutFolderAccess -Path $paths.Root -Account $script:AccucutLogCleanupSid -Rights ReadAndExecute');
    // update.ps1 lets the same account write in the logs folder when it checks it (rule B, -Writer), and nobody else.
    const update = code('deploy/windows/update.ps1');
    expect(update).toContain("$script:AccucutLogCleanupSid = 'S-1-5-19'");
    expect(update).toMatch(/Combine\(\$Root, 'logs'\)\) -Root \$Root -ProtectedRoot -Writer @\(\(Get-AccucutUpdateServiceSid -Name 'AccucutApp'\), \(Get-AccucutUpdateServiceSid -Name 'AccucutWorker'\), \$script:AccucutLogCleanupSid\)/);
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

  it('keeps one SQL source of the two roles, which the development database and the Windows install both read', () => {
    expect(read('deploy/db/create-roles.psql')).toContain('CREATE ROLE accucut_owner LOGIN PASSWORD');
    expect(read('docker/postgres-init/01-create-roles.sh')).toContain('--file "$roles_sql"');
    expect(read('deploy/windows/install.ps1')).toContain("sql\\create-roles.psql");
    expect(read('scripts/package-windows.ps1')).toContain('deploy\\db\\create-roles.psql');
  });
});
