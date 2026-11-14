# The two programs that the Windows package carries (ADR-015, STORY-10.04). Read by scripts/package-windows.ps1 and by CI stage 13
# (.github/workflows/windows-package.yml). Each program is downloaded from its address and refused unless its SHA-256 matches.
# Change a version and its hash together, in a reviewed change.
#
# The hash of WinSW was read from the release asset on 2026-11-14 (the release publishes no checksum file). The hash of age is the digest
# that GitHub shows for the release asset, and it was checked against the downloaded file.
@{
    WinSw = @{
        Version = '2.12.0'
        Licence = 'MIT'
        Url     = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'
        File    = 'WinSW-x64.exe'
        Sha256  = '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da'
    }
    Age   = @{
        Version = '1.3.2'
        Licence = 'BSD-3-Clause'
        Url     = 'https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-windows-amd64.zip'
        File    = 'age-v1.3.2-windows-amd64.zip'
        Sha256  = 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7'
    }
}
