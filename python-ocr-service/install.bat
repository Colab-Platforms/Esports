@echo off
echo ========================================
echo Installing Python OCR Service Dependencies
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
call venv\Scripts\activate

echo Installing core dependencies...
echo.

REM Upgrade pip first
python -m pip install --upgrade pip setuptools wheel

echo.
echo [1/5] Installing FastAPI and Uvicorn...
pip install fastapi "uvicorn[standard]" pydantic python-multipart

echo.
echo [2/5] Installing NumPy and Pillow...
pip install "numpy<2.0" pillow

echo.
echo [3/5] Installing OpenCV...
pip install opencv-python

echo.
echo [4/5] Installing PyTorch (CPU version - this will take a while)...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo.
echo [5/5] Installing EasyOCR...
pip install easyocr

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the service, run:
echo   python main.py
echo.
pause
