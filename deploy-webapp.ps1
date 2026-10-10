# Deploy only the AskPool frontend and Java backend. Run from any directory with PowerShell.
[CmdletBinding()]
param(
    [string]$SshHost = 'viscon-2026',
    [string]$VmPassword = $env:ASKPOOL_VM_PASSWORD,
    [string]$JdkPath,
    [string]$DatabaseUrl = 'jdbc:postgresql://postgres:5432/askpool',
    [string]$AppPasswordFile = '',
    [switch]$BaselineDatabase,
    [switch]$BuildOnly,
    [switch]$CheckConnection,
    [switch]$ValidateOnly,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot 'deploy/Deployment.psm1') -Force
$localConfig = Join-Path $PSScriptRoot 'deploy.local.json'
if (Test-Path -LiteralPath $localConfig) {
    $settings = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
    foreach ($name in @('SshHost', 'VmPassword', 'JdkPath', 'DatabaseUrl', 'AppPasswordFile')) {
        if (-not $PSBoundParameters.ContainsKey($name) -and $settings.PSObject.Properties[$name]) {
            if ($name -ne 'VmPassword' -or -not $env:ASKPOOL_VM_PASSWORD) { Set-Variable -Name $name -Value $settings.$name }
        }
    }
}

$repoRoot = $PSScriptRoot
$previousJavaHome = $env:JAVA_HOME
$previousGradleHome = $env:GRADLE_USER_HOME
Push-Location $repoRoot
try {
    if ($SshHost -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.@-]*$') {
        throw 'SshHost must be an SSH alias or user@hostname.'
    }
    if (($BuildOnly -and ($CheckConnection -or $ValidateOnly)) -or ($CheckConnection -and $ValidateOnly)) {
        throw 'Choose only one of BuildOnly, CheckConnection, or ValidateOnly.'
    }
    if (-not $BuildOnly) {
        Get-Command ssh.exe -ErrorAction Stop | Out-Null
    }
    if ($CheckConnection) {
        Invoke-Vm -RepoRoot $repoRoot -SshHost $SshHost -VmPassword $VmPassword -Mode 'check'
        Write-Host 'VM login and deployment prerequisites verified. No deployment was performed.'
        return
    }
    foreach ($tool in @('npm.cmd', 'tar.exe')) {
        Get-Command $tool -ErrorAction Stop | Out-Null
    }
    if ($DatabaseUrl -notmatch '^jdbc:postgresql://' -or $DatabaseUrl -match "['`r`n]" -or $AppPasswordFile -match "['`r`n]") {
        throw 'DatabaseUrl must be a PostgreSQL JDBC URL; database configuration cannot contain quotes or newlines.'
    }
    foreach ($config in @('deploy/compose.yaml', 'deploy/Caddyfile', 'deploy/deploy-webapp-vm.sh', 'frontend/package.json', 'backend/gradlew.bat')) {
        if (-not (Test-Path -LiteralPath $config)) { throw "Missing $config" }
    }

    # Prefer an explicit JDK, otherwise find the Java 21 installation on this PC.
    if (-not $JdkPath) {
        $javac = Get-Command javac.exe -ErrorAction SilentlyContinue
        $candidates = @($env:JAVA_HOME)
        if ($javac) { $candidates += Split-Path (Split-Path $javac.Source -Parent) -Parent }
        $candidates += 'C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot'
        foreach ($candidate in $candidates) {
            if ($candidate -and (Test-Path -LiteralPath "$candidate/bin/javac.exe")) {
                $version = & "$candidate/bin/javac.exe" -version 2>&1
                if ($LASTEXITCODE -eq 0 -and "$version" -match '^javac 21[.\s]') {
                    $JdkPath = $candidate
                    break
                }
            }
        }
    }
    if (-not $JdkPath -or -not (Test-Path -LiteralPath "$JdkPath/bin/javac.exe")) {
        throw 'JDK 21 was not found. Run with -JdkPath pointing to your JDK 21 root folder.'
    }
    $jdkVersion = & "$JdkPath/bin/javac.exe" -version 2>&1
    if ($LASTEXITCODE -ne 0 -or "$jdkVersion" -notmatch '^javac 21[.\s]') {
        throw "JDK 21 is required; found $jdkVersion"
    }
    $env:JAVA_HOME = $JdkPath
    $env:GRADLE_USER_HOME = Join-Path $repoRoot '.gradle-user-home'

    Write-Host 'Building and checking frontend...'
    if (-not $SkipInstall) { Invoke-Checked 'npm.cmd' @('--prefix', 'frontend', 'ci') }
    Invoke-Checked 'npm.cmd' @('--prefix', 'frontend', 'run', 'build')
    Invoke-Checked 'npm.cmd' @('--prefix', 'frontend', 'run', 'lint')
    Invoke-Checked 'npm.cmd' @('--prefix', 'frontend', 'run', 'test:api')
    Invoke-Checked 'npm.cmd' @('--prefix', 'frontend', 'run', 'test:professor-profile')

    Write-Host 'Building and testing backend with Java 21...'
    Push-Location (Join-Path $repoRoot 'backend')
    try { Invoke-Checked '.\gradlew.bat' @('test', 'bootJar', '--no-daemon') }
    finally { Pop-Location }

    $jars = @(Get-ChildItem 'backend/build/libs' -Filter '*.jar' |
        Where-Object { $_.Name -notlike '*-plain.jar' })
    if ($jars.Count -ne 1) { throw 'Expected exactly one executable backend JAR in backend/build/libs.' }

    $releaseId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
    $buildRoot = Join-Path $repoRoot "backend/build/deploy-$releaseId"
    $stage = Join-Path $buildRoot 'bundle'
    New-Item -ItemType Directory -Path "$stage/artifacts/frontend" -Force | Out-Null
    Copy-Item $jars[0].FullName "$stage/artifacts/backend.jar"
    Copy-Item 'frontend/dist/*' "$stage/artifacts/frontend" -Recurse
    Copy-Item 'deploy/compose.yaml', 'deploy/Caddyfile' $stage
    $archive = Join-Path $buildRoot "hackathon-$releaseId.tar.gz"
    Invoke-Checked 'tar.exe' @('-czf', $archive, '-C', $stage, 'compose.yaml', 'Caddyfile', 'artifacts')
    $archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()


    $remoteScript = Get-Content -LiteralPath (Join-Path $repoRoot 'deploy/deploy-webapp-vm.sh') -Raw
    $databaseUrlEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl))
    $secretPathEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($AppPasswordFile))
    $remoteScript = $remoteScript.Replace('__RELEASE_ID__', $releaseId).Replace('__ARCHIVE_HASH__', $archiveHash).Replace('__VALIDATE_ONLY__', [string][int][bool]$ValidateOnly).Replace('__BASELINE_DATABASE__', [string][int][bool]$BaselineDatabase).Replace('__DATABASE_URL_BASE64__', $databaseUrlEncoded).Replace('__APP_PASSWORD_FILE_BASE64__', $secretPathEncoded)
    $scriptFile = Join-Path $buildRoot "hackathon-$releaseId.sh"
    [System.IO.File]::WriteAllText($scriptFile, $remoteScript.Replace("`r`n", "`n") + "`n", [System.Text.UTF8Encoding]::new($false))

    if ($BuildOnly) {
        Write-Host "Build verified. Deployment bundle: $archive"
        Write-Host "VM script prepared without uploading: $scriptFile"
        return
    }
    Write-Host "Uploading and deploying the AskPool web app to $SshHost..."
    Invoke-Vm -RepoRoot $repoRoot -SshHost $SshHost -VmPassword $VmPassword -Mode 'deploy' -Archive $archive -ScriptFile $scriptFile
    if ($ValidateOnly) { Write-Host 'VM candidate validated. Production deployment was not changed.' }
    else { Write-Host 'Deployment complete: https://08.hackathon.ethz.ch (hackathon login required).' }
}
finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:GRADLE_USER_HOME = $previousGradleHome
    Pop-Location
}
