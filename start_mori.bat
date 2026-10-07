@echo off
echo ========================================
echo   M.O.R.I. - Tactical AI Command
echo   Starting Backend Server...
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Python virtual environment exists
if not exist "backend\venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv backend\venv
    echo [INFO] Installing Python dependencies...
    backend\venv\Scripts\pip install -r backend\requirements.txt
)

echo [INFO] Starting FastAPI backend on port 8000...
start "MORI-Backend" backend\venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

REM Wait for backend to start
timeout /t 3 /nobreak > nul

echo [INFO] Starting Next.js frontend on port 3000...
cd frontend
start "MORI-Frontend" npm run dev

echo.
echo ========================================
echo   M.O.R.I. is running!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo ========================================
echo.
echo Press any key to stop all services...
pause > nul

REM Kill the processes
taskkill /FI "WINDOWTITLE eq MORI-Backend" /F 2>nul
taskkill /FI "WINDOWTITLE eq MORI-Frontend" /F 2>nul
