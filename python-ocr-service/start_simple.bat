@echo off
echo ========================================
echo Starting BGMI OCR Service (Simple Mode)
echo ========================================
echo.
echo This version returns MOCK DATA for testing
echo No heavy dependencies required!
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install minimal dependencies
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing minimal dependencies...
    pip install fastapi uvicorn[standard] pydantic
    echo.
)

REM Start the simple service
echo Starting service on http://localhost:8000
echo Press Ctrl+C to stop
echo.
python main_simple.py
