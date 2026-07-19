@echo off
REM Launches the local dev server (vite + API) and opens the dashboard in a browser.
REM NOTE: This file must stay ASCII-only. cmd.exe reads batch files by byte offset,
REM       so multi-byte (Korean) characters desync the parser and corrupt execution.
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "CLIENT_PORT=5173"
set "SERVER_PORT=3001"
set "APP_URL=http://localhost:%CLIENT_PORT%/2026_candy/"

echo ==================================================
echo   2026_candy Local Dashboard
echo ==================================================
echo.

REM --- 1) Detect an already running dev server ------------------------------
REM If a port is taken, vite silently moves to 5174 while this script still opens
REM 5173 - so you end up looking at the old, possibly wedged server.
REM Detection is by port, so the live trading bot (bybit_trader.cjs) is never touched.
set "DEV_PIDS="
for %%P in (%CLIENT_PORT% %SERVER_PORT%) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        REM One process can listen on both IPv4 and IPv6, so skip PIDs already seen.
        if not defined SEEN_%%A (
            set "SEEN_%%A=1"
            set "DEV_PIDS=!DEV_PIDS! %%A"
        )
    )
)

if not "%DEV_PIDS%"=="" (
    REM Avoid "!" in echoed text - delayed expansion would swallow it.
    echo [WARN] A dev server is already running. PID:%DEV_PIDS%
    echo     Starting another one would bind a different port,
    echo     and the browser would open the old server instead.
    echo.
    choice /c YN /n /m "    Restart it? [Y=restart / N=just open browser]: "
    if errorlevel 2 goto :OPEN_ONLY

    echo.
    echo     Stopping old dev server...
    REM Kill the port owners (vite, API server) together with their children.
    for %%A in (%DEV_PIDS%) do taskkill /pid %%A /t /f >nul 2>&1
    REM Full path: a PATH from Git Bash etc. can shadow Windows timeout.exe.
    "%SystemRoot%\System32\timeout.exe" /t 2 /nobreak >nul
    echo     Done.
    echo.
)

REM --- 2) Schedule the browser to open once the server is up -----------------
echo [1/2] Opening browser in 6 seconds: %APP_URL%
start "" cmd /c ""%SystemRoot%\System32\timeout.exe" /t 6 >nul && start %APP_URL%"

REM --- 3) Run the dev server in this window ----------------------------------
echo [2/2] Starting dev server. Press Ctrl+C in this window to stop.
echo --------------------------------------------------
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm run dev failed to start.
    pause
)
goto :eof

:OPEN_ONLY
echo.
echo     Keeping the existing server. Opening browser only.
start "" %APP_URL%
goto :eof
