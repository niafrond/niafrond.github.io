@echo off
pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onefile --windowed --name "PDF Lite Reader" pdf_lite_reader.py
