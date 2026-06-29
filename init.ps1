# init.ps1 — Wrapper PowerShell del verificador del harness.
# Equivale a `npm run harness:verify`. Úsalo desde PowerShell: .\init.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $root "scripts\harness\verify.mjs")
exit $LASTEXITCODE
