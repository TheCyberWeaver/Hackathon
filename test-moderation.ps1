# Temporary local moderation portal. No VM or AskPool database is used.
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 8091,
    [ValidateRange(0.0, 1.0)][double]$Threshold = 0.95,
    [switch]$Stop,
    [switch]$SkipInstall,
    [switch]$Foreground
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$portalRoot = Join-Path $PSScriptRoot 'moderation'
$portalBuild = Join-Path $portalRoot 'build'
$portalState = Join-Path $portalBuild "portal-$Port.json"
$portalPython = Join-Path $portalRoot '.venv/Scripts/python.exe'

function Get-PortalProcess {
    if (-not (Test-Path -LiteralPath $portalState)) { return $null }
    $saved = Get-Content -LiteralPath $portalState -Raw | ConvertFrom-Json
    $process = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
    # The PID and creation time identify this exact launch even when Windows
    # cannot expose the executable path immediately after Start-Process.
    if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq $saved.startedTicks -and $process.ProcessName -eq 'python') { return $process }
    return $null
}

$running = Get-PortalProcess
if ($Stop) {
    if ($running) {
        & taskkill.exe /PID $running.Id /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop the moderation portal process.' }
        Write-Host 'Moderation portal stopped.'
    }
    else { Write-Host 'Moderation portal is already stopped.' }
    if (Test-Path -LiteralPath $portalState) { Remove-Item -LiteralPath $portalState }
    return
}
if ($running) { Write-Host "Moderation portal is already running: http://127.0.0.1:$Port"; return }
New-Item -ItemType Directory -Path $portalBuild -Force | Out-Null
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() }
catch { throw "Local port $Port is already in use. Choose another -Port." }
finally { $listener.Stop() }
if (-not (Test-Path -LiteralPath $portalPython)) {
    & python.exe -m venv (Join-Path $portalRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
    $SkipInstall = $false
}
if (-not $SkipInstall) {
    & $portalPython -m pip install --disable-pip-version-check -r (Join-Path $portalRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Could not install moderation dependencies.' }
}
$previousThreshold = $env:MODERATION_THRESHOLD
$previousOffline = $env:HF_HUB_OFFLINE
$previousCache = $env:MODERATION_CACHE_PATH
try {
    $env:MODERATION_THRESHOLD = $Threshold.ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $env:MODERATION_CACHE_PATH = Join-Path $portalRoot '.model-cache'
    # A complete local cache lets repeated tests avoid network requests.
    $cachedModel = Get-ChildItem (Join-Path $env:MODERATION_CACHE_PATH 'abuse-model') -Recurse -Filter 'model_quantized.onnx' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cachedModel) {
        $cacheComplete = $true
        foreach ($file in @('config.json', 'tokenizer.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $cachedModel.Directory.Parent.FullName $file))) { $cacheComplete = $false }
        }
        if ($cacheComplete) { $env:HF_HUB_OFFLINE = '1' }
    }
    $portalArguments = @(('"{0}"' -f (Join-Path $portalRoot 'test_portal.py')), '--port', $Port)
    if ($Foreground) {
        Write-Host "Moderation portal: http://127.0.0.1:$Port (wait for model startup). Ctrl+C or Stop portal closes it."
        & $portalPython (Join-Path $portalRoot 'test_portal.py') --port $Port
        return
    }
    $process = Start-Process -FilePath $portalPython -ArgumentList $portalArguments -WorkingDirectory $portalRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $portalBuild "portal-$Port.log") -RedirectStandardError (Join-Path $portalBuild "portal-$Port-error.log")
    @{pid=$process.Id; startedTicks=$process.StartTime.ToUniversalTime().Ticks; path=$process.Path} | ConvertTo-Json | Set-Content -LiteralPath $portalState
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($process.HasExited) { throw "Portal failed to start. See $portalBuild/portal-$Port-error.log" }
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 1
            if ($health.status -eq 'ok') { Write-Host "Moderation portal ready: http://127.0.0.1:$Port"; return }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    Write-Host "Portal is starting: http://127.0.0.1:$Port (model loading may take a few minutes)."
    Write-Host "Startup log: $portalBuild/portal-$Port-error.log"
}
finally {
    $env:MODERATION_THRESHOLD = $previousThreshold
    $env:HF_HUB_OFFLINE = $previousOffline
    $env:MODERATION_CACHE_PATH = $previousCache
}
