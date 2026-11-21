<#
.SYNOPSIS
  Levanta todo el sistema de expedientes en Docker, listo para probar.

.DESCRIPTION
  Comprueba Docker, prepara backend/.env (con claves de cifrado nuevas si faltan), descarga
  las imágenes, construye backend y frontend con sus dependencias, levanta todos los
  contenedores (PostgreSQL, dos instancias de Ollama, backend y frontend), descarga el modelo
  de lenguaje y espera a que todo responda. Se puede ejecutar las veces que haga falta.

.PARAMETER Detener
  Detiene y elimina los contenedores. Los datos (base, archivos y modelo) se conservan.

.PARAMETER Logs
  Muestra los registros de todos los contenedores en vivo (Ctrl+C para salir).

.PARAMETER Reconstruir
  Reconstruye las imágenes desde cero (sin caché), por ejemplo tras cambiar dependencias.

.PARAMETER SinEsperarModelo
  No espera a que termine la descarga del modelo (unos 2 GB la primera vez).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\run.ps1

.EXAMPLE
  .\run.ps1 -Detener
#>
[CmdletBinding()]
param(
    [switch]$Detener,
    [switch]$Logs,
    [switch]$Reconstruir,
    [switch]$SinEsperarModelo
)

# 'Continue' a propósito: en Windows PowerShell 5.1, con 'Stop', cualquier línea que Docker escriba
# en stderr (progreso, avisos) detiene el script. Los fallos de Docker se detectan por su código de
# salida en Invoke-Docker y los de PowerShell con -ErrorAction Stop donde importan.
$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot

$UrlApi = 'http://localhost:8000/api/health'
$UrlFrontend = 'http://localhost:5173'
$ArchivoEnv = Join-Path $PSScriptRoot 'backend\.env'
$EjemploEnv = Join-Path $PSScriptRoot 'backend\.env.example'
$Utf8SinBom = New-Object System.Text.UTF8Encoding $false

function Write-Paso([string]$Texto) {
    Write-Host ""
    Write-Host "==> $Texto" -ForegroundColor Cyan
}

function Write-Aviso([string]$Texto) {
    Write-Host "    AVISO: $Texto" -ForegroundColor Yellow
}

function Stop-ConError([string]$Texto) {
    Write-Host ""
    Write-Host "ERROR: $Texto" -ForegroundColor Red
    exit 1
}

function Invoke-Docker {
    # Los comandos nativos no lanzan excepciones: se revisa el código de salida a mano.
    param([Parameter(Mandatory)][string[]]$Argumentos, [string]$SiFalla = 'Falló un comando de Docker')
    & docker @Argumentos
    if ($LASTEXITCODE -ne 0) { Stop-ConError "$SiFalla (docker $($Argumentos -join ' '))" }
}

function New-ClaveBase64 {
    $bytes = New-Object byte[] 32
    $generador = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generador.GetBytes($bytes) } finally { $generador.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

function Get-ValorEnv([string]$Nombre, [string]$PorDefecto) {
    if (-not (Test-Path $ArchivoEnv)) { return $PorDefecto }
    $linea = Get-Content $ArchivoEnv | Where-Object { $_ -match "^\s*$Nombre\s*=" } | Select-Object -Last 1
    if (-not $linea) { return $PorDefecto }
    return ($linea -replace "^\s*$Nombre\s*=\s*", '').Trim().Trim("'").Trim('"')
}

function Wait-Url([string]$Url, [string]$Nombre, [int]$Segundos) {
    $limite = (Get-Date).AddSeconds($Segundos)
    while ((Get-Date) -lt $limite) {
        try {
            $respuesta = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($respuesta.StatusCode -eq 200) { Write-Host "    $Nombre responde en $Url" -ForegroundColor Green; return $true }
        } catch { Start-Sleep -Seconds 3 }
    }
    Write-Aviso "$Nombre no respondió en $Segundos s. Revisa: docker compose logs $($Nombre.ToLower())"
    return $false
}

# ------------------------------------------------------------------ Docker

Write-Paso 'Comprobando Docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-ConError 'No se encontró Docker. Instala Docker Desktop: https://www.docker.com/products/docker-desktop/'
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { Stop-ConError 'Docker no está corriendo. Abre Docker Desktop, espera a que arranque y vuelve a intentarlo.' }
& docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Stop-ConError 'Falta Docker Compose v2 (el comando "docker compose").' }
Write-Host '    Docker y Docker Compose disponibles.'

if ($Detener) {
    Write-Paso 'Deteniendo los contenedores (los datos se conservan)'
    Invoke-Docker -Argumentos @('compose', 'down', '--remove-orphans')
    exit 0
}

if ($Logs) {
    & docker compose logs -f --tail 100
    exit 0
}

# ------------------------------------------------------------------ backend/.env

Write-Paso 'Preparando backend/.env'
try {
if (-not (Test-Path $ArchivoEnv)) {
    if (-not (Test-Path $EjemploEnv)) { Stop-ConError 'No se encontró backend/.env.example.' }
    [System.IO.File]::WriteAllText($ArchivoEnv, [System.IO.File]::ReadAllText($EjemploEnv), $Utf8SinBom)
    Write-Host '    Se creó backend/.env a partir de backend/.env.example.'
}

# Sin claves de cifrado no se pueden subir expedientes: se generan las que falten.
$contenidoEnv = [System.IO.File]::ReadAllText($ArchivoEnv)
$nuevas = New-Object System.Collections.Generic.List[string]
if ($contenidoEnv -notmatch '(?m)^\s*CLAVES_CIFRADO\s*=') {
    $nuevas.Add("CLAVES_CIFRADO='{""v1"": ""$(New-ClaveBase64)""}'")
    $nuevas.Add('CLAVE_CIFRADO_ACTIVA=v1')
}
if ($contenidoEnv -notmatch '(?m)^\s*CLAVE_INDICE\s*=') { $nuevas.Add("CLAVE_INDICE=$(New-ClaveBase64)") }
if ($contenidoEnv -notmatch '(?m)^\s*PEPPER_PASSWORD\s*=') { $nuevas.Add("PEPPER_PASSWORD=$(New-ClaveBase64)") }
if ($nuevas.Count -gt 0) {
    $prefijo = if ($contenidoEnv.Length -gt 0 -and -not $contenidoEnv.EndsWith("`n")) { "`r`n" } else { '' }
    $bloque = $prefijo + "`r`n# Claves de cifrado generadas por run.ps1 (no las compartas ni las subas al repositorio)`r`n" + ($nuevas -join "`r`n") + "`r`n"
    [System.IO.File]::AppendAllText($ArchivoEnv, $bloque, $Utf8SinBom)
    Write-Host "    Se generaron $($nuevas.Count) valores de cifrado nuevos en backend/.env." -ForegroundColor Green
    Write-Aviso 'Guarda una copia de backend/.env: sin esas claves no se pueden leer los expedientes cifrados.'
} else {
    Write-Host '    backend/.env ya tiene sus claves de cifrado.'
}
} catch {
    Stop-ConError "No se pudo preparar backend/.env: $($_.Exception.Message)"
}
$Modelo = Get-ValorEnv 'OLLAMA_MODEL' 'qwen2.5:3b'

# ------------------------------------------------------------------ Puertos

Write-Paso 'Revisando puertos'
$enMarcha = @(& docker compose ps -q --status running 2>$null).Count
if ($enMarcha -eq 0 -and (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    foreach ($puerto in 5432, 8000, 5173) {
        if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) {
            Write-Aviso "El puerto $puerto está ocupado por otra aplicación; ese contenedor no podrá arrancar."
        }
    }
}
Write-Host '    Listo.'

# ------------------------------------------------------------------ Imágenes y dependencias

Write-Paso 'Descargando imágenes base (PostgreSQL, Ollama)'
Invoke-Docker -Argumentos @('compose', 'pull', '--ignore-buildable') -SiFalla 'No se pudieron descargar las imágenes'

Write-Paso 'Construyendo backend y frontend (instala dependencias de Python y Node)'
$argumentosBuild = @('compose', 'build')
if ($Reconstruir) { $argumentosBuild += @('--no-cache', '--pull') }
Invoke-Docker -Argumentos $argumentosBuild -SiFalla 'Falló la construcción de las imágenes'

Write-Paso 'Levantando todos los contenedores'
Invoke-Docker -Argumentos @('compose', 'up', '-d', '--remove-orphans') -SiFalla 'No se pudieron levantar los contenedores'
# Solo el frontend renueva su volumen de node_modules, para usar siempre las dependencias de su imagen.
# No se aplica a todo: recrearía la base y Ollama, y cortaría una descarga del modelo en curso.
Invoke-Docker -Argumentos @('compose', 'up', '-d', '--no-deps', '--renew-anon-volumes', 'frontend') -SiFalla 'No se pudo levantar el frontend'

# ------------------------------------------------------------------ Modelo

if (-not $SinEsperarModelo) {
    Write-Paso "Descargando el modelo $Modelo (unos 2 GB la primera vez; después es inmediato)"
    # Si un intento anterior falló o se cortó, se vuelve a lanzar: Ollama reanuda lo ya descargado.
    $idPull = (& docker compose ps -a -q ollama-pull | Select-Object -First 1)
    if ($idPull) {
        $previo = (& docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' $idPull).Trim()
        if ($previo -like 'exited*' -and $previo -notlike '* 0') {
            Invoke-Docker -Argumentos @('compose', 'up', '-d', '--force-recreate', 'ollama-pull') -SiFalla 'No se pudo relanzar la descarga del modelo'
            $idPull = (& docker compose ps -a -q ollama-pull | Select-Object -First 1)
        }
    }
    $limite = (Get-Date).AddMinutes(45)
    $ultimo = ''
    while ($idPull -and (Get-Date) -lt $limite) {
        $estado = (& docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' $idPull).Trim()
        if ($estado -notlike 'running*' -and $estado -notlike 'created*') { break }
        # Última línea del progreso, sin los códigos de color de la terminal.
        $linea = (& docker logs --tail 2 $idPull 2>&1 | ForEach-Object { ("$_" -split "`r")[-1] -replace '\x1b\[[0-9;?]*[A-Za-z]', '' } |
            Where-Object { $_.Trim() } | Select-Object -Last 1)
        if ($linea -and $linea -ne $ultimo) { Write-Host "    $($linea.Trim())"; $ultimo = $linea }
        Start-Sleep -Seconds 5
    }
    if ($idPull -and $estado -notlike '* 0') {
        Write-Aviso "La descarga del modelo terminó con estado '$estado'. Revisa: docker compose logs ollama-pull"
    }
    foreach ($instancia in 'ollama-1', 'ollama-2') {
        $lista = (& docker compose exec -T $instancia ollama list 2>$null) -join "`n"
        if ($lista -match [regex]::Escape($Modelo)) {
            Write-Host "    $instancia tiene el modelo $Modelo." -ForegroundColor Green
        } else {
            Write-Aviso "$instancia todavía no ve el modelo $Modelo. Repite .\run.ps1 cuando termine la descarga."
        }
    }
}

# ------------------------------------------------------------------ Servicios

Write-Paso 'Esperando a que los servicios respondan'
$apiOk = Wait-Url -Url $UrlApi -Nombre 'Backend' -Segundos 180
$frontOk = Wait-Url -Url $UrlFrontend -Nombre 'Frontend' -Segundos 180

Write-Host ""
& docker compose ps --format 'table {{.Service}}\t{{.Status}}'
Write-Host ""
if ($apiOk -and $frontOk) {
    Write-Host 'Todo listo para probar.' -ForegroundColor Green
} else {
    Write-Host 'Algunos servicios no respondieron; revisa los registros.' -ForegroundColor Yellow
}
Write-Host "  Aplicación:          $UrlFrontend"
Write-Host '  API y documentación: http://localhost:8000/docs'
Write-Host '  Ver registros:       .\run.ps1 -Logs'
Write-Host '  Detener todo:        .\run.ps1 -Detener'
