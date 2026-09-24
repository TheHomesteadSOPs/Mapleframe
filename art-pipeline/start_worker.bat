@echo off
setlocal

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python not found. Installing via winget...
    winget install -e --id Python.Python.3.12
    echo.
    echo Python was just installed. Please close this window and double-click start_worker.bat again.
    pause
    exit /b
)

echo Installing/checking required packages...
python -m pip install --quiet --upgrade requests

echo.
echo Starting OpenRouter image worker for Mapleframe game art. Leave this window open while it runs.
echo Press Ctrl+C to stop.
echo.
python "%~dp0openrouter_worker.py"

pause
