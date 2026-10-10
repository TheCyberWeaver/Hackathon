# Deploy AskPool and its moderation service. Run from any directory with PowerShell.
[CmdletBinding()]
param(
    [string]$SshHost = 'viscon-2026',
    [string]$VmPassword = 'X9xfZcQGTeTnxguX5eTs',
    [string]$JdkPath,
    [string]$DatabaseUrl = 'jdbc:postgresql://postgres:5432/askpool',
    [string]$AppPasswordFile = '',
    [switch]$BaselineDatabase,
    [switch]$BuildOnly,
    [switch]$CheckConnection,
    [switch]$ValidateOnly,
    [switch]$SkipInstall,
    [ValidateRange(0.0, 1.0)][double]$ModerationThreshold = 0.95
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. Deployment stopped."
    }
}

function Invoke-Vm {
    param([string]$Mode, [string]$Archive, [string]$ScriptFile)
    if (-not $VmPassword) {
        $sshOptions = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes')
        if ($Mode -eq 'check') {
            Invoke-Checked 'ssh.exe' ($sshOptions + @($SshHost, "set -eu; command -v docker >/dev/null; command -v curl >/dev/null; command -v sha256sum >/dev/null; command -v flock >/dev/null; docker compose version; docker info --format '{{.ServerVersion}}'; df -h ."))
        }
        else {
            Get-Command scp.exe -ErrorAction Stop | Out-Null
            Invoke-Checked 'scp.exe' ($sshOptions + @($Archive, $ScriptFile, "${SshHost}:"))
            $scriptName = [System.IO.Path]::GetFileName($ScriptFile)
            Invoke-Checked 'ssh.exe' ($sshOptions + @($SshHost, "bash '$scriptName'"))
        }
        return
    }
    $toolsRoot = Join-Path $repoRoot 'backend/build/deploy-tools'
    $pythonPath = Join-Path $toolsRoot 'venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        Get-Command python.exe -ErrorAction Stop | Out-Null
        Invoke-Checked 'python.exe' @('-m', 'venv', (Join-Path $toolsRoot 'venv'))
    }
    & $pythonPath -c "import importlib.util, importlib.metadata, sys; spec = importlib.util.find_spec('paramiko'); sys.exit(0 if spec and importlib.metadata.version('paramiko') == '4.0.0' else 1)"
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Preparing local SSH password support...'
        Invoke-Checked $pythonPath @('-m', 'pip', 'install', '--disable-pip-version-check', '--index-url', 'https://pypi.org/simple', 'paramiko==4.0.0')
    }
    $helper = @'
import argparse
import os
from pathlib import Path
import shlex
import subprocess
import sys
import paramiko

parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=['check', 'deploy'])
parser.add_argument('alias')
parser.add_argument('known_hosts')
parser.add_argument('--archive')
parser.add_argument('--script')
args = parser.parse_args()

def run(client, command):
    with client.get_transport().open_session(timeout=30) as channel:
        channel.set_combine_stderr(True)
        channel.exec_command(command)
        channel.shutdown_write()
        while True:
            chunk = channel.recv(65536)
            if not chunk:
                break
            sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()
        status = channel.recv_exit_status()
        if status:
            raise RuntimeError(f'Remote command failed with exit code {status}')

try:
    resolved = subprocess.run(['ssh.exe', '-G', args.alias], check=True, capture_output=True, text=True)
    config = dict(line.split(' ', 1) for line in resolved.stdout.splitlines() if ' ' in line)
    hostname = config['hostname']
    username = config['user']
    port = int(config.get('port', '22'))
    if config.get('proxycommand', 'none') != 'none' or config.get('proxyjump', 'none') != 'none':
        raise RuntimeError('Use a direct SSH alias for this VM; jump hosts are not supported by this helper.')
    password = os.environ.pop('ASKPOOL_VM_PASSWORD')
    known_hosts = Path(args.known_hosts)
    if not known_hosts.is_file():
        raise RuntimeError(f'Missing known-hosts file: {known_hosts}. Connect using OpenSSH once to verify the VM host key.')
    with paramiko.SSHClient() as client:
        client.load_host_keys(str(known_hosts))
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(hostname, port=port, username=username, password=password,
                       allow_agent=False, look_for_keys=False, timeout=20,
                       banner_timeout=20, auth_timeout=20)
        del password
        print(f'Authenticated to {username}@{hostname}:{port}', flush=True)
        if args.mode == 'check':
            run(client, "set -eu; command -v docker >/dev/null; command -v curl >/dev/null; command -v sha256sum >/dev/null; command -v flock >/dev/null; docker compose version; docker info --format '{{.ServerVersion}}'; df -h .")
        else:
            if not args.archive or not args.script:
                raise RuntimeError('Deployment archive and script are required')
            with client.open_sftp() as sftp:
                remote_directory = sftp.normalize('.')
                for local_path in (args.archive, args.script):
                    source = Path(local_path)
                    remote_path = remote_directory + '/' + source.name
                    print(f'Uploading {source.name} ({source.stat().st_size:,} bytes)...', flush=True)
                    sftp.put(str(source), remote_path, confirm=True)
                remote_script = remote_directory + '/' + Path(args.script).name
            run(client, 'bash ' + shlex.quote(remote_script))
except Exception as error:
    print(f'Deployment SSH error: {error}', file=sys.stderr)
    sys.exit(1)
'@
    $helperPath = Join-Path $toolsRoot 'vm-transport.py'
    [System.IO.File]::WriteAllText($helperPath, $helper.Replace("`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
    $knownHosts = Join-Path $env:USERPROFILE '.ssh/known_hosts'
    $arguments = @($helperPath, $Mode, $SshHost, $knownHosts)
    if ($Mode -eq 'deploy') { $arguments += @('--archive', $Archive, '--script', $ScriptFile) }
    $previousPassword = $env:ASKPOOL_VM_PASSWORD
    try {
        $env:ASKPOOL_VM_PASSWORD = $VmPassword
        Invoke-Checked $pythonPath $arguments
    }
    finally { $env:ASKPOOL_VM_PASSWORD = $previousPassword }
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
        Invoke-Vm -Mode 'check'
        Write-Host 'VM login and deployment prerequisites verified. No deployment was performed.'
        return
    }
    foreach ($tool in @('npm.cmd', 'tar.exe')) {
        Get-Command $tool -ErrorAction Stop | Out-Null
    }
    if ($DatabaseUrl -notmatch '^jdbc:postgresql://' -or $DatabaseUrl -match "['`r`n]" -or $AppPasswordFile -match "['`r`n]") {
        throw 'DatabaseUrl must be a PostgreSQL JDBC URL; database configuration cannot contain quotes or newlines.'
    }
    foreach ($config in @('deploy/compose.yaml', 'deploy/Caddyfile', 'deploy/deploy-vm.sh', 'frontend/package.json', 'backend/gradlew.bat', 'moderation/Dockerfile', 'moderation/app.py', 'moderation/moderator.py', 'moderation/check_model.py')) {
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
    New-Item -ItemType Directory -Path "$stage/moderation" -Force | Out-Null
    foreach ($file in @('Dockerfile', '.dockerignore', 'requirements.txt', 'app.py', 'moderator.py', 'model_files.py', 'check_model.py', 'check_backend.py')) {
        Copy-Item (Join-Path $repoRoot "moderation/$file") "$stage/moderation/$file"
    }
    $archive = Join-Path $buildRoot "hackathon-$releaseId.tar.gz"
    Invoke-Checked 'tar.exe' @('-czf', $archive, '-C', $stage, 'compose.yaml', 'Caddyfile', 'artifacts', 'moderation')
    $archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()


    $remoteScript = Get-Content -LiteralPath (Join-Path $repoRoot 'deploy/deploy-vm.sh') -Raw
    $databaseUrlEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl))
    $secretPathEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($AppPasswordFile))
    $remoteScript = $remoteScript.Replace('__RELEASE_ID__', $releaseId).Replace('__ARCHIVE_HASH__', $archiveHash).Replace('__VALIDATE_ONLY__', [string][int][bool]$ValidateOnly).Replace('__BASELINE_DATABASE__', [string][int][bool]$BaselineDatabase).Replace('__DATABASE_URL_BASE64__', $databaseUrlEncoded).Replace('__APP_PASSWORD_FILE_BASE64__', $secretPathEncoded).Replace('__MODERATION_THRESHOLD__', $ModerationThreshold.ToString([System.Globalization.CultureInfo]::InvariantCulture))
    $scriptFile = Join-Path $buildRoot "hackathon-$releaseId.sh"
    [System.IO.File]::WriteAllText($scriptFile, $remoteScript.Replace("`r`n", "`n") + "`n", [System.Text.UTF8Encoding]::new($false))

    if ($BuildOnly) {
        Write-Host "Build verified. Deployment bundle: $archive"
        Write-Host "VM script prepared without uploading: $scriptFile"
        return
    }
    Write-Host "Uploading and deploying AskPool and moderation to $SshHost..."
    Invoke-Vm -Mode 'deploy' -Archive $archive -ScriptFile $scriptFile
    if ($ValidateOnly) { Write-Host 'VM candidate validated. Production deployment was not changed.' }
    else { Write-Host 'Deployment complete: https://08.hackathon.ethz.ch (hackathon login required).' }
}
finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:GRADLE_USER_HOME = $previousGradleHome
    Pop-Location
}
