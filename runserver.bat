@echo off
setlocal
set PYTHON=%~dp0.venv\Scripts\python.exe
if not exist "%PYTHON%" (
  echo Python executable not found at %PYTHON% - activate your venv or update the script.
  exit /b 1
)

set PORT=8001
if "%1" NEQ "" set PORT=%1

echo Starting Django development server on 127.0.0.1:%PORT%...
"%PYTHON%" manage.py runserver 127.0.0.1:%PORT%
