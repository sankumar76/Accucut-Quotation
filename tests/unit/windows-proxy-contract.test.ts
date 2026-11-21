import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ADR-017 and #576 (architecture section 8 "Reverse proxy contract"; docs PR for v0.58): what the Windows service file and the install script must carry.
 * These are text checks of files that no unit test can run (PowerShell and WinSW); the behaviour of the install's proxy checks is judged by the Pester tests
 * (`deploy/windows/tests/Proxy.Tests.ps1`), which CI runs on a Windows runner.
 */

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const serviceFile = read('deploy/windows/services/AccucutApp.xml');
const workerFile = read('deploy/windows/services/AccucutWorker.xml');
const install = read('deploy/windows/install.ps1');
const operations = read('deploy/windows/AccucutOps.psm1');
const values = read('deploy/windows/values.example.txt');

describe('AccucutApp.xml (ADR-017 decision 2; RISK-032, architecture section 8 P6)', () => {
  it('caps the main thread heap at 1,024 MB, before the env file and the script', () => {
    expect(serviceFile).toContain('<arguments>--max-old-space-size=1024 --env-file="{{ENV_FILE}}" server.js</arguments>');
  });

  it('keeps an idle connection for 125 s, longer than the proxy\x27s 60 s', () => {
    expect(serviceFile).toContain('<env name="KEEP_ALIVE_TIMEOUT" value="125000"/>');
  });

  it('is well formed where it counts: no comment holds a double hyphen (WinSW would refuse the file), and no comment names the retired clean-logs.ps1', () => {
    const comments = [...serviceFile.matchAll(/<!--([\s\S]*?)-->/g)].map((match) => match[1] ?? '');
    expect(comments.length).toBeGreaterThan(0);
    for (const comment of comments) expect(comment).not.toContain('--');
    expect(serviceFile).not.toContain('clean-logs');
  });

  it('the worker\x27s service file is unchanged in this respect: no heap option and no keep-alive', () => {
    expect(workerFile).not.toContain('max-old-space-size');
    expect(workerFile).not.toContain('KEEP_ALIVE_TIMEOUT');
  });
});

describe('the install with -WithProxy (#576)', () => {
  it('values.example.txt shows the https address of a proxy', () => {
    expect(values).toContain('APP_ORIGIN=https://CHANGE_ME_SERVER_NAME\n');
    expect(values).not.toContain('http://CHANGE_ME_SERVER_NAME');
  });

  it('refuses an APP_ORIGIN that is not https while the settings are collected, before anything is created, and only with -WithProxy', () => {
    expect(install).toContain('if ($WithProxy) { Assert-AccucutProxyOrigin -Origin $values[\x27APP_ORIGIN\x27] }');
    expect(install).toContain('-DatabaseName $script:DatabaseName -WithProxy:$WithProxy');
    const refusal = install.indexOf('Assert-AccucutProxyOrigin -Origin');
    expect(refusal).toBeGreaterThan(install.indexOf('function Get-AccucutInstallSettings'));
    expect(refusal).toBeLessThan(install.indexOf('function Invoke-AccucutInstall {'));
  });

  it('ends with the proxy checks, only with -WithProxy, last in the try block, and never stops the install for a failed check', () => {
    const calls = [...install.matchAll(/Invoke-AccucutProxyChecks -Origin/g)];
    expect(calls).toHaveLength(1);
    const at = install.indexOf('Invoke-AccucutProxyChecks -Origin');
    expect(install.slice(install.lastIndexOf('if ($WithProxy) {', at), at)).toContain('try {');
    // After the first backup and the Admin\x27s account, so a problem with the proxy cannot get in the way of what the portal needs.
    expect(at).toBeGreaterThan(install.indexOf('Invoke-AccucutFirstBackup -PsqlPath'));
    expect(at).toBeGreaterThan(install.indexOf('Register-AccucutAdminEndpoint -Paths'));
    // A failed check is said as a warning at the end; the proxy may not be installed yet.
    expect(install).toContain('$proxyFailed.Count -gt 0');
    expect(install).toContain('-Level Warning');
  });

  it('the module exports the functions of checks C2, C3 and C5', () => {
    for (const name of [
      'Assert-AccucutProxyOrigin',
      'Get-AccucutHttpResponse',
      'Test-AccucutProxyRedirect',
      'Test-AccucutProxyHeaders',
      'Test-AccucutClientAddressSeen',
      'Write-AccucutProxyCheckResult',
      'Invoke-AccucutProxyChecks',
    ]) {
      expect(operations, `${name} is defined`).toContain(`function ${name} {`);
      expect(operations.slice(operations.indexOf('Export-ModuleMember')), `${name} is exported`).toContain(`'${name}'`);
    }
  });

  it('check C3 asks for the exact HSTS value the architecture gives the proxy, and C5 sends the forged address the guide uses', () => {
    expect(operations).toContain("'max-age=31536000'");
    expect(operations).toContain("$forged = '203.0.113.7'");
  });
});
