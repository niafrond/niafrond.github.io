@echo off
cd /d "%~dp0"
pip install -r requirements.txt pyinstaller
pyinstaller --onefile --windowed --name "PDF Batch Print" pdf_batch_print.py
echo.
echo Executable disponible dans dist\PDF Batch Print.exe
pause
