$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8766
$Url = "http://127.0.0.1:$Port/"
$ServerScript = Join-Path $Root "laser_editor_server.py"
$LogPath = Join-Path $env:TEMP "laser_editor_launcher.log"
$OutLog = Join-Path $env:TEMP "laser_editor_server_stdout.log"
$ErrLog = Join-Path $env:TEMP "laser_editor_server_stderr.log"

function Write-LauncherLog {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Test-LaserEditorServer {
    try {
        # /api/* is token-protected. The launcher verifies the token-bootstrap
        # page instead of weakening the local API security boundary.
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return [int]$response.StatusCode -eq 200 -and $response.Content -match 'id="editorCanvas"'
    } catch {
        return $false
    }
}

function Stop-StaleLaserEditorPort {
    try {
        $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($listener in $listeners) {
            $ownerPid = [int]$listener.OwningProcess
            if ($ownerPid -le 0 -or $ownerPid -eq $PID) {
                continue
            }
            $process = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
            if ($process -and $process.ProcessName -match "python|py") {
                Write-LauncherLog "Stopping stale process on port ${Port}: PID $ownerPid $($process.ProcessName)"
                Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 600
            }
        }
    } catch {
        Write-LauncherLog "Port cleanup failed: $($_.Exception.Message)"
    }
}

if (-not (Test-Path -LiteralPath $ServerScript)) {
    [System.Windows.Forms.MessageBox]::Show("laser_editor_server.py bulunamadi: $ServerScript", "Lazer Is Editoru") | Out-Null
    exit 1
}

if (-not (Test-LaserEditorServer)) {
    Stop-StaleLaserEditorPort
    $python = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $python) {
        $python = (Get-Command py -ErrorAction SilentlyContinue).Source
    }
    if (-not $python) {
        [System.Windows.Forms.MessageBox]::Show("Python bulunamadi. Python PATH icinde olmali.", "Lazer Is Editoru") | Out-Null
        exit 1
    }

    Remove-Item -LiteralPath $OutLog, $ErrLog -Force -ErrorAction SilentlyContinue
    Write-LauncherLog "Starting server with $python"
    $serverProcess = Start-Process -FilePath $python -ArgumentList @("`"$ServerScript`"", "$Port", "--no-open") -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru
    Write-LauncherLog "Server process started: PID $($serverProcess.Id)"

    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        if (Test-LaserEditorServer) {
            break
        }
        Start-Sleep -Milliseconds 400
    }
}

if (Test-LaserEditorServer) {
    Write-LauncherLog "Server ready: $Url"
    Start-Process $Url
    exit 0
}

$stderr = ""
if (Test-Path -LiteralPath $ErrLog) {
    $stderr = (Get-Content -LiteralPath $ErrLog -Raw -ErrorAction SilentlyContinue)
}
$message = "Lazer Is Editoru baslatilamadi.`n`nLog: $LogPath`nHata: $ErrLog"
if ($stderr) {
    $message += "`n`n$stderr"
}
[System.Windows.Forms.MessageBox]::Show($message, "Lazer Is Editoru") | Out-Null
exit 1
