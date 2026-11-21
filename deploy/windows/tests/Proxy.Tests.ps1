#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of the reverse-proxy checks of the install (#576; architecture section 8 "Reverse proxy contract", install guide "Reverse proxy"): the https-only
  APP_ORIGIN of an install with -WithProxy, the three pure judges of checks C2, C3 and C5, and the order of the checks. Every request is mocked; all values are invented.
#>

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    . (Join-Path $script:WindowsDirectory 'install.ps1')
    $script:Template = Read-AccucutEnvTemplate -Path (Join-Path $script:WindowsDirectory '..\..\.env.example')

    function Write-ValuesFile {
        param([string]$Origin)
        $file = Join-Path $TestDrive ('values-' + [guid]::NewGuid().ToString('N') + '.txt')
        $lines = @(
            "APP_ORIGIN=$Origin"
            'ADMIN_EMAIL=first.admin@example.test'
            'ADMIN_INITIAL_PASSWORD=Fake-first-pass-3!'
            'PG_SUPERUSER_PASSWORD=FAKE-pg-admin-pass-4'
            'BACKUP_AGE_RECIPIENT=age1' + ('q' * 58)
        )
        [System.IO.File]::WriteAllText($file, ($lines -join "`n"))
        return $file
    }
}

Describe 'APP_ORIGIN with -WithProxy (P1)' {
    It 'accepts the https address of the proxy' {
        { Assert-AccucutProxyOrigin -Origin 'https://portal.example.test' } | Should -Not -Throw
    }

    It 'refuses anything else, and says nothing was changed' {
        foreach ($origin in 'http://portal.example.test', 'http://server:3000', 'portal.example.test', '', 'https://portal.example.test/path', 'https://') {
            { Assert-AccucutProxyOrigin -Origin $origin } | Should -Throw '*must be the https address*Nothing was changed*'
        }
    }

    It 'the install settings refuse an http address with -WithProxy, before anything is created' {
        $file = Write-ValuesFile -Origin 'http://server.example.test:3000'
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' -WithProxy } | Should -Throw '*APP_ORIGIN must be the https address*'
    }

    It 'the install settings accept the https address with -WithProxy, and an http address without it' {
        $secure = Get-AccucutInstallSettings -Template $script:Template -ValuesFile (Write-ValuesFile -Origin 'https://portal.example.test') -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' -WithProxy
        $secure.Values['APP_ORIGIN'] | Should -Be 'https://portal.example.test'
        $plain = Get-AccucutInstallSettings -Template $script:Template -ValuesFile (Write-ValuesFile -Origin 'http://server.example.test:3000') -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut'
        $plain.Values['APP_ORIGIN'] | Should -Be 'http://server.example.test:3000'
    }
}

Describe 'check C2: http goes to https (P1)' {
    It 'passes for a 301 or a 308 to the sign-in page of the https address' {
        @(Test-AccucutProxyRedirect -Status 308 -Location 'https://p.example.test/sign-in' -Origin 'https://p.example.test').Count | Should -Be 0
        @(Test-AccucutProxyRedirect -Status 301 -Location 'https://p.example.test/sign-in' -Origin 'https://p.example.test').Count | Should -Be 0
    }

    It 'fails for an answer that is not a redirect, and for a redirect to another place' {
        @(Test-AccucutProxyRedirect -Status 200 -Location '' -Origin 'https://p.example.test') | Should -Match 'not a redirect'
        @(Test-AccucutProxyRedirect -Status 302 -Location '' -Origin 'https://p.example.test') | Should -Match 'not a redirect'
        @(Test-AccucutProxyRedirect -Status 301 -Location 'https://other.example.test/' -Origin 'https://p.example.test') | Should -Match 'not to'
    }
}

Describe 'check C3: the headers (P3)' {
    BeforeAll {
        $script:Good = @{
            'strict-transport-security' = @('max-age=31536000')
            'content-security-policy'   = @("default-src 'self'; frame-ancestors 'none'")
            'x-content-type-options'    = @('nosniff')
            'referrer-policy'           = @('same-origin')
            'permissions-policy'        = @('camera=()')
        }
    }

    It 'passes when HSTS is once, the portal headers come through, and no Server or X-Powered-By is sent' {
        @(Test-AccucutProxyHeaders -Headers $script:Good).Count | Should -Be 0
    }

    It 'fails for each missing or wrong header, naming it' {
        $without = $script:Good.Clone(); $without.Remove('strict-transport-security')
        @(Test-AccucutProxyHeaders -Headers $without) | Should -Match 'Strict-Transport-Security'
        $twice = $script:Good.Clone(); $twice['strict-transport-security'] = @('max-age=31536000', 'max-age=31536000')
        @(Test-AccucutProxyHeaders -Headers $twice) | Should -Match 'Strict-Transport-Security'
        $short = $script:Good.Clone(); $short['strict-transport-security'] = @('max-age=300')
        @(Test-AccucutProxyHeaders -Headers $short) | Should -Match 'Strict-Transport-Security'
        $framed = $script:Good.Clone(); $framed['content-security-policy'] = @("default-src 'self'")
        @(Test-AccucutProxyHeaders -Headers $framed) | Should -Match "frame-ancestors"
        $sniff = $script:Good.Clone(); $sniff.Remove('x-content-type-options')
        @(Test-AccucutProxyHeaders -Headers $sniff) | Should -Match 'nosniff'
        $referrer = $script:Good.Clone(); $referrer.Remove('referrer-policy')
        @(Test-AccucutProxyHeaders -Headers $referrer) | Should -Match 'Referrer-Policy'
        $permissions = $script:Good.Clone(); $permissions.Remove('permissions-policy')
        @(Test-AccucutProxyHeaders -Headers $permissions) | Should -Match 'Permissions-Policy'
        $server = $script:Good.Clone(); $server['server'] = @('Caddy')
        @(Test-AccucutProxyHeaders -Headers $server) | Should -Match 'Server header'
        $powered = $script:Good.Clone(); $powered['x-powered-by'] = @('Next.js')
        @(Test-AccucutProxyHeaders -Headers $powered) | Should -Match 'X-Powered-By'
    }
}

Describe 'check C5: the real address, last (P2)' {
    It 'passes for an IPv4 or IPv6 address that is not the one the request pretended to forward' {
        @(Test-AccucutClientAddressSeen -Seen '198.51.100.4' -Sent '203.0.113.7').Count | Should -Be 0
        @(Test-AccucutClientAddressSeen -Seen '2001:db8::1' -Sent '203.0.113.7').Count | Should -Be 0
    }

    It 'fails when there is no header, when the portal found no address, when it took the forwarded one, and when a port or text came through' {
        @(Test-AccucutClientAddressSeen -Seen '' -Sent '203.0.113.7') | Should -Match 'no X-Client-Address-Seen'
        @(Test-AccucutClientAddressSeen -Seen 'none' -Sent '203.0.113.7') | Should -Match 'no usable address'
        @(Test-AccucutClientAddressSeen -Seen '203.0.113.7' -Sent '203.0.113.7') | Should -Match 'pretended to forward'
        @(Test-AccucutClientAddressSeen -Seen '198.51.100.4:51234' -Sent '203.0.113.7') | Should -Match 'without a port'
        @(Test-AccucutClientAddressSeen -Seen 'nonsense' -Sent '203.0.113.7') | Should -Match 'without a port'
    }
}


Describe 'Invoke-AccucutProxyChecks: C2, C3 and C5 against the address people type' {
    BeforeAll {
        # The mock bodies run in the module's scope and cannot see this file's variables, so each answer is built as text and turned into a script block that holds only literals.
        $script:GoodHeaders = @'
'strict-transport-security' = @('max-age=31536000'); 'content-security-policy' = @("default-src 'self'; frame-ancestors 'none'"); 'x-content-type-options' = @('nosniff'); 'referrer-policy' = @('same-origin'); 'permissions-policy' = @('camera=()')
'@
        $script:HeadersWithoutHsts = @'
'content-security-policy' = @("default-src 'self'; frame-ancestors 'none'"); 'x-content-type-options' = @('nosniff'); 'referrer-policy' = @('same-origin'); 'permissions-policy' = @('camera=()')
'@
        function script:New-Answer {
            param([int]$Status = 200, [string]$HeaderText = '', [string]$ErrorText = '')
            return [scriptblock]::Create("@{ Status = $Status; Headers = @{ $HeaderText }; Error = '$ErrorText' }")
        }
    }

    BeforeEach {
        # A proxy that does what the guide asks.
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'http://*' } -MockWith (New-Answer -Status 308 -HeaderText "'location' = @('https://p.example.test/sign-in')")
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/sign-in' } -MockWith (New-Answer -HeaderText $script:GoodHeaders)
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/api/health' } -MockWith (New-Answer -HeaderText "'x-client-address-seen' = @('198.51.100.4')")
    }

    It 'returns no failed check when the proxy does what the guide asks' {
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test').Count | Should -Be 0
    }

    It 'names C2 when plain http does not go to https' {
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'http://*' } -MockWith (New-Answer -Status 200)
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test') | Should -Be @('C2')
    }

    It 'names C3 when HSTS is missing' {
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/sign-in' } -MockWith (New-Answer -HeaderText $script:HeadersWithoutHsts)
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test') | Should -Be @('C3')
    }

    It 'names C5 when the portal took the forwarded address' {
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/api/health' } -MockWith (New-Answer -HeaderText "'x-client-address-seen' = @('203.0.113.7')")
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test') | Should -Be @('C5')
    }

    It 'names C5 when the portal found no address' {
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/api/health' } -MockWith (New-Answer -HeaderText "'x-client-address-seen' = @('none')")
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test') | Should -Be @('C5')
    }

    It 'names all three when nothing answers, which is what an install with no proxy yet shows' {
        # A mock with a filter wins over one without, so each of the three is replaced by its own.
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'http://*' } -MockWith (New-Answer -Status 0 -ErrorText 'connection refused')
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/sign-in' } -MockWith (New-Answer -Status 0 -ErrorText 'connection refused')
        Mock Get-AccucutHttpResponse -ModuleName AccucutOps -ParameterFilter { $Url -like 'https://*/api/health' } -MockWith (New-Answer -Status 0 -ErrorText 'connection refused')
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test') | Should -Be @('C2', 'C3', 'C5')
    }

    It 'skips C2 for an address with a port and does not ask plain http at all, and still runs C3 and C5' {
        @(Invoke-AccucutProxyChecks -Origin 'https://p.example.test:8443').Count | Should -Be 0
        Should -Invoke Get-AccucutHttpResponse -ModuleName AccucutOps -Times 0 -Exactly -ParameterFilter { $Url -like 'http://*' }
        Should -Invoke Get-AccucutHttpResponse -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Url -like 'https://*/sign-in' }
    }

    It 'sends a forwarded address the portal must not believe, to the health page only' {
        Invoke-AccucutProxyChecks -Origin 'https://p.example.test' | Out-Null
        Should -Invoke Get-AccucutHttpResponse -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Url -like 'https://*/api/health' -and $RequestHeaders['X-Forwarded-For'] -eq '203.0.113.7' }
        Should -Invoke Get-AccucutHttpResponse -ModuleName AccucutOps -Times 0 -Exactly -ParameterFilter { $Url -like 'https://*/sign-in' -and $RequestHeaders.Count -gt 0 }
    }
}
