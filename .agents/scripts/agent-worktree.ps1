#Requires -Version 7
<#
.SYNOPSIS
  Crea, lista o elimina el worktree aislado de una feature para un motor
  (claude o codex).

.EXAMPLE
  pwsh .agents/scripts/agent-worktree.ps1 -Action new -Id F-001 -Engine claude
  pwsh .agents/scripts/agent-worktree.ps1 -Action list
  pwsh .agents/scripts/agent-worktree.ps1 -Action remove -Id F-001 -Engine claude
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('new', 'remove', 'list')]
    [string]$Action,

    [string]$Id,

    [ValidateSet('claude', 'codex')]
    [string]$Engine,

    [string]$Base = 'main',

    [switch]$AllowDirty,
    [switch]$DeleteBranch
)

$ErrorActionPreference = 'Stop'

$common = git rev-parse --path-format=absolute --git-common-dir 2>$null
if (-not $common) { throw 'No es un repositorio git.' }
$Main = Split-Path ($common.Trim()) -Parent
$RepoName = Split-Path $Main -Leaf
$WtRoot = Join-Path (Split-Path $Main -Parent) "$RepoName-wt"
$Claim = Join-Path $PSScriptRoot 'claim.ps1'

function Get-Names {
    if (-not $Id -or -not $Engine) { throw "$Action requiere -Id y -Engine." }
    $board = Get-Content -Raw -Encoding utf8 (Join-Path $Main '.agents/feature_list.json') | ConvertFrom-Json
    $f = $board.features | Where-Object { $_.id -eq $Id }
    if (-not $f) { throw "No existe la feature $Id." }
    return [pscustomobject]@{
        Branch = "agent/$Engine/$Id-$($f.name)"
        Path   = Join-Path $WtRoot "$Engine-$Id"
    }
}

switch ($Action) {
    'list' {
        git -C $Main worktree list
    }

    'new' {
        $n = Get-Names

        $ignored = '^(\.agents/|\.claude/|AGENTS\.md$|CLAUDE\.md$)'
        $dirty = git -C $Main status --porcelain |
            Where-Object { ($_.Substring(3) -replace '"', '') -notmatch $ignored }
        if ($dirty -and -not $AllowDirty) {
            $dirty | Select-Object -First 15 | ForEach-Object { Write-Warning $_ }
            throw "El checkout principal tiene cambios sin confirmar; el worktree nacería sin ellos. Confírmalos o usa -AllowDirty."
        }

        git -C $Main cat-file -e "${Base}:.agents/AGENTS.md" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning ".agents/ no está confirmado en ${Base}: el worktree no tendrá roles ni reglas. Usa las rutas absolutas del checkout principal o confirma .agents/ antes."
        }

        if (Test-Path $n.Path) { throw "Ya existe $($n.Path)." }
        New-Item -ItemType Directory -Force $WtRoot | Out-Null

        git -C $Main show-ref --verify --quiet "refs/heads/$($n.Branch)"
        if ($LASTEXITCODE -eq 0) {
            git -C $Main worktree add $n.Path $n.Branch
        }
        else {
            git -C $Main worktree add -b $n.Branch $n.Path $Base
        }
        if ($LASTEXITCODE -ne 0) { throw 'git worktree add falló.' }

        & $Claim -Action set -Id $Id -Engine $Engine -Branch $n.Branch -Worktree $n.Path -Note "worktree $($n.Path)" | Out-Null
        Write-Output "Worktree: $($n.Path)"
        Write-Output "Rama:     $($n.Branch)"
        Write-Output "Compose:  docker compose -p exp-$Engine-$($Id.ToLower()) run --rm --no-deps <servicio> <comando>"
    }

    'remove' {
        $n = Get-Names
        if (Test-Path $n.Path) {
            git -C $Main worktree remove $n.Path
            if ($LASTEXITCODE -ne 0) { throw "No se pudo eliminar $($n.Path) (¿cambios sin confirmar?)." }
        }

        $merged = git -C $Main branch --merged $Base --format '%(refname:short)'
        if ($DeleteBranch) {
            git -C $Main branch -D $n.Branch
        }
        elseif ($merged -contains $n.Branch) {
            git -C $Main branch -d $n.Branch
        }
        else {
            Write-Warning "La rama $($n.Branch) no está integrada en $Base; se conserva."
        }

        & $Claim -Action set -Id $Id -Worktree '' | Out-Null
        Write-Output "Worktree de $Id eliminado."
    }
}
