# Deploy only the AskPool moderation service. Run from any directory with PowerShell.
[CmdletBinding()]
param(
    [string]$SshHost = 'viscon-2026',
    [string]$VmPassword = 'X9xfZcQGTeTnxguX5eTs',
    [switch]$BuildOnly,
    [switch]$CheckConnection,
    [switch]$ValidateOnly,
    [switch]$SkipInstall,
    [ValidateRange(0.0, 1.0)][double]$ModerationThreshold = 0.95
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot 'deploy/Deployment.psm1') -Force
$localConfig = Join-Path $PSScriptRoot 'deploy.local.json'
if (Test-Path -LiteralPath $localConfig) {
    $settings = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
    foreach ($name in @('SshHost', 'VmPassword')) {
        if (-not $PSBoundParameters.ContainsKey($name) -and $settings.PSObject.Properties[$name]) {
            if ($name -ne 'VmPassword' -or -not $env:ASKPOOL_VM_PASSWORD) { Set-Variable -Name $name -Value $settings.$name }
        }
    }
}

$repoRoot = $PSScriptRoot
Push-Location $repoRoot
try {
    if ($SshHost -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.@-]*$') { throw 'SshHost must be an SSH alias or user@hostname.' }
    if (($BuildOnly -and ($CheckConnection -or $ValidateOnly)) -or ($CheckConnection -and $ValidateOnly)) { throw 'Choose only one of BuildOnly, CheckConnection, or ValidateOnly.' }
    if (-not $BuildOnly) { Get-Command ssh.exe -ErrorAction Stop | Out-Null }
    if ($CheckConnection) {
        Invoke-Vm -RepoRoot $repoRoot -SshHost $SshHost -VmPassword $VmPassword -Mode 'check'
        Write-Host 'VM deployment prerequisites verified. No deployment was performed.'
        return
    }
    Get-Command tar.exe -ErrorAction Stop | Out-Null
    Write-Host 'Checking moderation service...'
    $moderationPython = Join-Path $repoRoot 'moderation/.venv/Scripts/python.exe'
    $newEnvironment = -not (Test-Path -LiteralPath $moderationPython)
    if ($newEnvironment) {
        Invoke-Checked 'python.exe' @('-m', 'venv', (Join-Path $repoRoot 'moderation/.venv'))
    }
    if ($newEnvironment -or -not $SkipInstall) {
        Invoke-Checked $moderationPython @('-m', 'pip', 'install', '--disable-pip-version-check', '-r', (Join-Path $repoRoot 'moderation/requirements-test.txt'))
    }
    Push-Location (Join-Path $repoRoot 'moderation')
    try { Invoke-Checked $moderationPython @('-m', 'unittest', 'discover', '-s', 'tests', '-v') }
    finally { Pop-Location }

    $releaseId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
    $buildRoot = Join-Path $repoRoot "backend/build/moderation-deploy-$releaseId"
    $stage = Join-Path $buildRoot 'bundle'
    New-Item -ItemType Directory -Path "$stage/moderation" -Force | Out-Null
    foreach ($file in @('Dockerfile', '.dockerignore', 'requirements.txt', 'app.py', 'moderator.py', 'model_files.py', 'check_model.py', 'check_backend.py')) {
        Copy-Item (Join-Path $repoRoot "moderation/$file") "$stage/moderation/$file"
    }
    Copy-Item 'deploy/compose.moderation.yaml' "$stage/compose.yaml"
    $archive = Join-Path $buildRoot "moderation-$releaseId.tar.gz"
    Invoke-Checked 'tar.exe' @('-czf', $archive, '-C', $stage, 'compose.yaml', 'moderation')
    $archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $remoteScript = Get-Content -LiteralPath 'deploy/deploy-moderation-vm.sh' -Raw
    $remoteScript = $remoteScript.Replace('__RELEASE_ID__', $releaseId).Replace('__ARCHIVE_HASH__', $archiveHash).Replace('__VALIDATE_ONLY__', $(if ($ValidateOnly) { '1' } else { '0' })).Replace('__MODERATION_THRESHOLD__', $ModerationThreshold.ToString([System.Globalization.CultureInfo]::InvariantCulture))
    $scriptFile = Join-Path $buildRoot "moderation-$releaseId.sh"
    [System.IO.File]::WriteAllText($scriptFile, $remoteScript.Replace("`r`n", "`n") + "`n", [System.Text.UTF8Encoding]::new($false))
    if ($BuildOnly) { Write-Host "Build verified. Deployment bundle: $archive"; return }
    Invoke-Vm -RepoRoot $repoRoot -SshHost $SshHost -VmPassword $VmPassword -Mode 'deploy' -Archive $archive -ScriptFile $scriptFile
    if ($ValidateOnly) { Write-Host 'Moderation candidate validated. Production was not changed.' }
    else { Write-Host 'Moderation service deployed. The web app was not restarted.' }
}
finally { Pop-Location }
