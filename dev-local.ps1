# Local development only: persistent PostgreSQL + Java + Vite, without Docker or VM access.
[CmdletBinding()]
param([string]$JdkPath, [switch]$SkipInstall,
      [ValidateRange(1024, 65535)][int]$DatabasePort = 55432,
      [ValidateRange(1024, 65535)][int]$BackendPort = 8080,
      [ValidateRange(1024, 65535)][int]$FrontendPort = 5173)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskFrontend = $null
$taskOldJavaHome = $env:JAVA_HOME
$taskOldGradleHome = $env:GRADLE_USER_HOME
$taskOldApiBase = $env:VITE_API_BASE_URL
$taskOldDemoAuth = $env:ASKPOOL_DEMO_AUTH
$taskOldBackendUrl = $env:ASKPOOL_BACKEND_URL
Push-Location $PSScriptRoot
try {
    if (@($DatabasePort, $BackendPort, $FrontendPort | Select-Object -Unique).Count -ne 3) { throw 'Choose three distinct local ports.' }
    foreach ($taskPort in @($DatabasePort, $BackendPort, $FrontendPort)) {
        foreach ($taskAddress in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::IPv6Loopback)) {
            if ($taskAddress.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetworkV6 -and -not [System.Net.Sockets.Socket]::OSSupportsIPv6) { continue }
            $taskListener = [System.Net.Sockets.TcpListener]::new($taskAddress, $taskPort)
            try { $taskListener.Start() }
            catch { throw "Local port $taskPort is already in use. Stop the existing local service before running this script." }
            finally { $taskListener.Stop() }
        }
    }
    if (-not $JdkPath) {
        $taskJava = Get-Command java.exe -ErrorAction Stop
        $taskCandidates = @($env:JAVA_HOME, (Split-Path (Split-Path $taskJava.Source -Parent) -Parent), 'C:/Program Files/Eclipse Adoptium/jdk-21.0.8.9-hotspot')
        foreach ($taskCandidate in $taskCandidates) {
            if ($taskCandidate -and (Test-Path -LiteralPath "$taskCandidate/bin/javac.exe")) {
                $taskVersion = & "$taskCandidate/bin/javac.exe" -version 2>&1
                if ($LASTEXITCODE -eq 0 -and "$taskVersion" -match '^javac 21[.\s]') { $JdkPath = $taskCandidate; break }
            }
        }
    }
    if (-not $JdkPath -or -not (Test-Path -LiteralPath "$JdkPath/bin/javac.exe")) { throw 'Install JDK 21 or supply -JdkPath pointing to its root directory.' }
    $taskVersion = & "$JdkPath/bin/javac.exe" -version 2>&1
    if ($LASTEXITCODE -ne 0 -or "$taskVersion" -notmatch '^javac 21[.\s]') { throw 'JDK 21 is required.' }
    $env:JAVA_HOME = $JdkPath
    $env:GRADLE_USER_HOME = Join-Path $PSScriptRoot '.gradle-user-home'
    if (-not $SkipInstall -or -not (Test-Path -LiteralPath 'frontend/node_modules/vite/bin/vite.js')) {
        & npm.cmd --prefix frontend ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    }
    Push-Location (Join-Path $PSScriptRoot 'backend')
    try {
        & .\gradlew.bat writeLocalClasspath
        if ($LASTEXITCODE -ne 0) { throw 'Local backend build failed.' }
    } finally { Pop-Location }
    $taskClasspath = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'backend/build/local/classpath.txt'))
    $taskLogs = Join-Path $PSScriptRoot 'backend/build/local'
    $env:VITE_API_BASE_URL = '/'
    $env:ASKPOOL_DEMO_AUTH = 'true'
    $env:ASKPOOL_BACKEND_URL = "http://127.0.0.1:$BackendPort"
    $taskNode = (Get-Command node.exe -ErrorAction Stop).Source
    $taskFrontend = Start-Process -FilePath $taskNode -ArgumentList @('node_modules/vite/bin/vite.js', '--port', $FrontendPort, '--strictPort') -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogs 'vite.log') -RedirectStandardError (Join-Path $taskLogs 'vite-error.log')
    if ($taskFrontend.WaitForExit(1000)) { throw "Vite failed to start. Inspect $taskLogs/vite-error.log." }
    Write-Host "Local app: http://localhost:$FrontendPort (wait for Java to report Started LocalApplication)"
    Write-Host "Database: 127.0.0.1:$DatabasePort / askpool / askpool_app / empty password"
    Write-Host 'All signed-in users have testing permissions. Ctrl+C stops the local app; database contents are retained.'
    & "$JdkPath/bin/java.exe" -cp $taskClasspath com.example.backend.dev.LocalApplication (Join-Path $PSScriptRoot 'backend/.local-postgres') $DatabasePort $BackendPort "http://localhost:$FrontendPort,http://127.0.0.1:$FrontendPort"
    if ($LASTEXITCODE -ne 0) { throw "Local Java exited with code $LASTEXITCODE. Inspect the output above." }
} finally {
    if ($taskFrontend -and -not $taskFrontend.HasExited) { Stop-Process -Id $taskFrontend.Id }
    $env:JAVA_HOME = $taskOldJavaHome
    $env:GRADLE_USER_HOME = $taskOldGradleHome
    $env:VITE_API_BASE_URL = $taskOldApiBase
    $env:ASKPOOL_DEMO_AUTH = $taskOldDemoAuth
    $env:ASKPOOL_BACKEND_URL = $taskOldBackendUrl
    Pop-Location
}
