#Requires -Version 7
<#
.SYNOPSIS
  Lee y modifica el tablero compartido .agents/feature_list.json de forma segura
  para sesiones de Claude y Codex que trabajan a la vez.

.DESCRIPTION
  Todas las escrituras se serializan con un candado atómico (mkdir) en
  .agents/locks/_board del checkout principal, aunque el script se ejecute
  desde un worktree.

.EXAMPLE
  pwsh .agents/scripts/claim.ps1 -Action list
  pwsh .agents/scripts/claim.ps1 -Action ready
  pwsh .agents/scripts/claim.ps1 -Action claim -Id F-001 -Engine codex
  pwsh .agents/scripts/claim.ps1 -Action set -Id F-001 -Status review -Note "pytest 18/18"
  pwsh .agents/scripts/claim.ps1 -Action unlock
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('list', 'ready', 'claim', 'set', 'unlock')]
    [string]$Action,

    [string]$Id,

    [ValidateSet('claude', 'codex')]
    [string]$Engine,

    [ValidateSet('pending', 'in_progress', 'review', 'done', 'blocked')]
    [string]$Status,

    [string]$Note,

    # Cadena vacía = borrar el campo.
    [AllowEmptyString()][string]$Branch,
    [AllowEmptyString()][string]$Worktree,

    # Solo para pruebas: tablero alternativo.
    [string]$BoardPath
)

$ErrorActionPreference = 'Stop'

function Get-MainRoot {
    $common = git rev-parse --path-format=absolute --git-common-dir 2>$null
    if (-not $common) { throw 'No es un repositorio git.' }
    return (Split-Path ($common.Trim()) -Parent)
}

if (-not $BoardPath) {
    $BoardPath = Join-Path (Get-MainRoot) '.agents/feature_list.json'
}
$BoardPath = (Resolve-Path $BoardPath).Path
$LockRoot = Join-Path (Split-Path $BoardPath -Parent) 'locks'
$BoardLock = Join-Path $LockRoot '_board'

function Enter-BoardLock {
    New-Item -ItemType Directory -Force $LockRoot | Out-Null
    for ($i = 0; $i -lt 100; $i++) {
        try {
            New-Item -ItemType Directory -Path $BoardLock -ErrorAction Stop | Out-Null
            Set-Content -Path (Join-Path $BoardLock 'owner') -Value "$Engine $PID $(Get-Date -Format o)"
            return
        }
        catch {
            $item = Get-Item $BoardLock -ErrorAction SilentlyContinue
            if ($item -and ((Get-Date) - $item.CreationTime).TotalMinutes -gt 2) {
                Remove-Item -Recurse -Force $BoardLock -ErrorAction SilentlyContinue
                continue
            }
            Start-Sleep -Milliseconds 200
        }
    }
    throw "No se pudo obtener el candado del tablero ($BoardLock). Si no hay otra sesión escribiendo, ejecuta -Action unlock."
}

function Exit-BoardLock {
    Remove-Item -Recurse -Force $BoardLock -ErrorAction SilentlyContinue
}

function Read-Board {
    return (Get-Content -Raw -Encoding utf8 $BoardPath | ConvertFrom-Json)
}

function Save-Board($board) {
    $tmp = "$BoardPath.tmp"
    $json = $board | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($tmp, $json + "`n", [System.Text.UTF8Encoding]::new($false))
    Move-Item -Force $tmp $BoardPath
}

function Get-Feature($board, [string]$featureId) {
    $f = $board.features | Where-Object { $_.id -eq $featureId }
    if (-not $f) { throw "No existe la feature $featureId." }
    return $f
}

function ConvertTo-NormalPath([string]$p) {
    return ($p -replace '\\', '/').Trim()
}

function Test-PathOverlap([string[]]$a, [string[]]$b) {
    foreach ($x in $a) {
        $x = ConvertTo-NormalPath $x
        foreach ($y in $b) {
            $y = ConvertTo-NormalPath $y
            if ($x -eq $y) { return "$x" }
            if ($x.EndsWith('/') -and $y.StartsWith($x)) { return "$y" }
            if ($y.EndsWith('/') -and $x.StartsWith($y)) { return "$x" }
        }
    }
    return $null
}

function Get-BlockReason($board, $f, [string]$engine) {
    if ($f.status -ne 'pending') { return "estado actual: $($f.status)" }
    if ($engine -and $f.engine -ne 'any' -and $f.engine -ne $engine) {
        return "reservada para el motor $($f.engine)"
    }
    foreach ($dep in @($f.depends_on)) {
        $d = $board.features | Where-Object { $_.id -eq $dep }
        if (-not $d -or $d.status -ne 'done') { return "dependencia $dep sin terminar" }
    }
    $active = $board.features | Where-Object { $_.id -ne $f.id -and $_.status -in @('in_progress', 'review') }
    foreach ($o in $active) {
        $hit = Test-PathOverlap @($f.files) @($o.files)
        if ($hit) { return "archivo $hit en uso por $($o.id) ($($o.owner))" }
    }
    return $null
}

function Add-Note($f, [string]$text) {
    if (-not $text) { return }
    $who = if ($Engine) { $Engine } else { 'orquestador' }
    $f.notes = @($f.notes) + "$(Get-Date -Format 'yyyy-MM-dd HH:mm') [$who] $text"
}

function Set-Field($f, [string]$name, $value) {
    if ($f.PSObject.Properties[$name]) { $f.$name = $value }
    else { $f | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}

switch ($Action) {
    'list' {
        $board = Read-Board
        $board.features | Select-Object id, status, engine, owner, module, title | Format-Table -AutoSize
    }

    'ready' {
        $board = Read-Board
        $ready = $board.features | Where-Object { -not (Get-BlockReason $board $_ $Engine) }
        if (-not $ready) { Write-Output 'No hay features listas.'; break }
        $ready | Select-Object id, engine, module, title, @{ n = 'files'; e = { $_.files -join ', ' } } | Format-Table -AutoSize
    }

    'claim' {
        if (-not $Id -or -not $Engine) { throw 'claim requiere -Id y -Engine.' }
        Enter-BoardLock
        try {
            $board = Read-Board
            $f = Get-Feature $board $Id
            $reason = Get-BlockReason $board $f $Engine
            if ($reason) { throw "No se puede reclamar ${Id}: $reason." }
            $f.status = 'in_progress'
            $f.owner = $Engine
            Add-Note $f ($Note ? $Note : 'reclamada')
            Save-Board $board
            Write-Output "$Id reclamada por $Engine."
        }
        finally { Exit-BoardLock }
    }

    'set' {
        if (-not $Id) { throw 'set requiere -Id.' }
        Enter-BoardLock
        try {
            $board = Read-Board
            $f = Get-Feature $board $Id
            if ($Status) {
                $f.status = $Status
                if ($Status -eq 'pending') {
                    $f.owner = $null
                    $f.branch = $null
                    $f.worktree = $null
                }
                elseif ($Engine -and $Status -eq 'in_progress') {
                    $f.owner = $Engine
                }
            }
            if ($PSBoundParameters.ContainsKey('Branch')) { Set-Field $f 'branch' ($Branch ? $Branch : $null) }
            if ($PSBoundParameters.ContainsKey('Worktree')) { Set-Field $f 'worktree' ($Worktree ? $Worktree : $null) }
            Add-Note $f $Note
            Save-Board $board
            Write-Output "$Id -> $($f.status)"
        }
        finally { Exit-BoardLock }
    }

    'unlock' {
        Exit-BoardLock
        Write-Output 'Candado del tablero liberado.'
    }
}
