param(
    [int]$Port = 8001
)

Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

$python = Join-Path $root ".venv\Scripts\python.exe"
if (-Not (Test-Path $python)) {
    Write-Host "Python executable not found at $python. Activate your venv or adjust the script." -ForegroundColor Yellow
    Exit 1
}

Write-Host "Starting Django development server on 127.0.0.1:$Port..."
& $python manage.py runserver "127.0.0.1:$Port"

Pop-Location
