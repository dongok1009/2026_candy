@echo off
chcp 65001 >nul
cd /d "c:\dev\2026_candy"

echo [1/2] Starting background task to open browser in 6 seconds...
start "" cmd /c "timeout /t 6 >nul && start http://localhost:5173/2026_candy/"

echo [2/2] Starting local development server...
echo --------------------------------------------------
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm run dev failed to start.
    pause
)
