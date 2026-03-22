@echo off
echo ============================================
echo  Stopping server, clearing cache, restarting
echo ============================================

:: Kill ALL processes on port 8001 (parent + child reloader)
echo [1/4] Stopping server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001"') do (
    taskkill /PID %%a /F >nul 2>&1
    taskkill /PID %%a /T /F >nul 2>&1
)
:: Also kill any orphan python runserver processes
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST ^| findstr "PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr "runserver" >nul && taskkill /PID %%a /T /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Clear all __pycache__
echo [2/4] Clearing Python cache...
cd /d "D:\GoogleDrive\personal folder\Apps\amolnama_news\amolnama_news_project"
for /d /r %%d in (__pycache__) do (
    if exist "%%d" rd /s /q "%%d"
)

:: Collect static files
echo [3/4] Collecting static files...
python manage.py collectstatic --noinput >nul 2>&1

@REM :: Start server
@REM echo [4/4] Starting server on 127.0.0.1:8001...
@REM echo ============================================
@REM echo  Server running. Press Ctrl+C to stop.
@REM echo ============================================
@REM python manage.py runserver 127.0.0.1:8001
