@echo off
echo Starting BGMI OCR Microservice...
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
call venv\Scripts\activate

REM Check if dependencies are installed
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
    echo.
)

REM Start the service
echo Starting FastAPI server on http://localhost:8000
echo Press Ctrl+C to stop
echo.
python main.py
