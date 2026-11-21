#Requires -Version 7
<#
.SYNOPSIS
  Genera el espejo .claude/ (agents y skills) a partir de .agents/, que es la
  fuente única de verdad. Codex lee .agents/ directamente.

.EXAMPLE
  pwsh .agents/scripts/sync-agents.ps1          # sincroniza
  pwsh .agents/scripts/sync-agents.ps1 -Check   # falla si el espejo está desactualizado
#>
[CmdletBinding()]
param([switch]$Check)

$ErrorActionPreference = 'Stop'

$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Src = Join-Path $Root '.agents'
$Dst = Join-Path $Root '.claude'
$Manifest = Join-Path $Dst '.agents-sync.json'

# Pares origen -> destino gestionados por este script.
$pairs = @()
foreach ($f in Get-ChildItem (Join-Path $Src 'agents') -Filter *.md) {
    $pairs += [pscustomobject]@{ From = $f.FullName; To = Join-Path $Dst "agents/$($f.Name)" }
}
foreach ($dir in Get-ChildItem (Join-Path $Src 'skills') -Directory) {
    foreach ($f in Get-ChildItem $dir.FullName -Recurse -File) {
        $rel = [System.IO.Path]::GetRelativePath($dir.FullName, $f.FullName)
        $pairs += [pscustomobject]@{ From = $f.FullName; To = Join-Path $Dst "skills/$($dir.Name)/$rel" }
    }
}

$managed = $pairs | ForEach-Object { [System.IO.Path]::GetRelativePath($Dst, $_.To) -replace '\\', '/' }
$previous = if (Test-Path $Manifest) { @(Get-Content -Raw $Manifest | ConvertFrom-Json) } else { @() }
$stale = $previous | Where-Object { $_ -notin $managed }

$diffs = @()
foreach ($p in $pairs) {
    if (-not (Test-Path $p.To) -or (Get-FileHash $p.From).Hash -ne (Get-FileHash $p.To).Hash) {
        $diffs += $p.To
    }
}
foreach ($s in $stale) {
    $path = Join-Path $Dst $s
    if (Test-Path $path) { $diffs += $path }
}

if ($Check) {
    if ($diffs) {
        $diffs | ForEach-Object { Write-Warning "Desactualizado: $_" }
        Write-Error 'El espejo .claude/ no coincide con .agents/. Ejecuta sync-agents.ps1.'
        exit 1
    }
    Write-Output 'Espejo .claude/ al día.'
    exit 0
}

foreach ($p in $pairs) {
    New-Item -ItemType Directory -Force (Split-Path $p.To -Parent) | Out-Null
    Copy-Item -Force $p.From $p.To
}
foreach ($s in $stale) {
    Remove-Item -Force (Join-Path $Dst $s) -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force $Dst | Out-Null
[System.IO.File]::WriteAllText($Manifest, (ConvertTo-Json @($managed)) + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Sincronizados $($pairs.Count) archivos en .claude/ ($($stale.Count) obsoletos eliminados)."
