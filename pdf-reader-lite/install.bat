@echo off
setlocal enabledelayedexpansion

set "EXE=%~dp0dist\PDF Lite Reader.exe"

if not exist "%EXE%" (
    echo Executable introuvable, construction en cours...
    call "%~dp0build_exe.bat"
)

if not exist "%EXE%" (
    echo.
    echo Echec: "%EXE%" n'existe toujours pas apres la construction.
    pause
    exit /b 1
)

set "APPKEY=HKCU\Software\Classes\Applications\PDF Lite Reader.exe"

reg add "%APPKEY%\shell\open\command" /ve /d "\"%EXE%\" \"%%1\"" /f >nul
reg add "%APPKEY%" /v "FriendlyAppName" /t REG_SZ /d "PDF Lite Reader" /f >nul
reg add "%APPKEY%\SupportedTypes" /v ".pdf" /t REG_SZ /d "" /f >nul

echo.
echo Installation terminee.
echo Clic droit sur un PDF, "Ouvrir avec" -^> "Choisir une autre application",
echo puis selectionnez "PDF Lite Reader".
echo.
pause
