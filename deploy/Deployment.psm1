Set-StrictMode -Version Latest
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. Deployment stopped."
    }
}

function Invoke-Vm {
    param([string]$Mode, [string]$Archive, [string]$ScriptFile, [string]$RepoRoot, [string]$SshHost, [string]$VmPassword)
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


Export-ModuleMember -Function Invoke-Checked, Invoke-Vm
