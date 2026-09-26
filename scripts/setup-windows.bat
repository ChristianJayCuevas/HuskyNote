@echo off
rem ========================================================
rem   HuskyNote - Automated Windows Desktop Installer
rem   Capture it. Understand it. Keep it.
rem ========================================================
title HuskyNote Setup - Personal AI Secretary

setlocal enabledelayedexpansion

echo ========================================================
echo   HuskyNote Desktop - Windows Automated Installation
echo   Capture it. Understand it. Keep it.
echo ========================================================
echo.

rem 1. Check Git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [Notice] Git is not detected in PATH.
  echo If you want to contribute to the source, install Git from https://git-scm.com/
)

rem 2. Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [Error] Node.js is not installed or not in PATH.
  echo Please install Node.js (LTS version) from https://nodejs.org/ and rerun.
  pause
  exit /b 1
)

rem 3. Determine Installation Directory
if exist "package.json" (
  set "APP_DIR=%CD%"
) else (
  set "APP_DIR=%USERPROFILE%\.huskynote"
  if not exist "!APP_DIR!" (
    echo [HuskyNote] Cloning HuskyNote repository to !APP_DIR!...
    git clone https://github.com/ChristianJayCuevas/HuskyNote.git "!APP_DIR!"
  ) else (
    echo [HuskyNote] Updating existing HuskyNote in !APP_DIR!...
    cd /d "!APP_DIR!"
    git pull
  )
)

cd /d "!APP_DIR!"

rem 4. Configure Local AI (Ollama)
echo [HuskyNote] Checking local Ollama AI service...
where ollama >nul 2>nul
if %ERRORLEVEL% equ 0 (
  powershell -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>nul
  if !ERRORLEVEL! equ 0 (
    echo [HuskyNote] Ollama AI service is already running on http://localhost:11434
  ) else (
    echo [HuskyNote] Starting Ollama service with CORS enabled (OLLAMA_ORIGINS="*")...
    set OLLAMA_ORIGINS=*
    start /b "" ollama serve >nul 2>&1
    timeout /t 3 /nobreak >nul
  )
) else (
  echo [HuskyNote] Ollama is not installed. HuskyNote will run in browser-first mode.
  echo [HuskyNote] To enable local offline AI models, install Ollama from https://ollama.com/download/windows
)

rem 5. Install Dependencies
echo.
echo [HuskyNote] Verifying Node dependencies...
if not exist "node_modules" (
  call npm install --no-audit --no-fund
)

rem 6. Create Windows Desktop and Start Menu Shortcuts with App Icon
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\HuskyNote.lnk"
set "START_MENU_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\HuskyNote.lnk"
set "ICON_PATH=!APP_DIR!\public\favicon.ico"
echo [HuskyNote] Creating Desktop Shortcut...

powershell -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c cd /d \"!APP_DIR!\" && npm run dev'; $s.WorkingDirectory = '!APP_DIR!'; if (Test-Path '%ICON_PATH%') { $s.IconLocation = '%ICON_PATH%'; } $s.Save(); $s2 = $ws.CreateShortcut('%START_MENU_PATH%'); $s2.TargetPath = 'cmd.exe'; $s2.Arguments = '/c cd /d \"!APP_DIR!\" && npm run dev'; $s2.WorkingDirectory = '!APP_DIR!'; if (Test-Path '%ICON_PATH%') { $s2.IconLocation = '%ICON_PATH%'; } $s2.Save();"

echo [HuskyNote] Shortcut created on Desktop: HuskyNote.lnk
echo [HuskyNote] Shortcut created in Start Menu: HuskyNote.lnk
echo.
echo ========================================================
echo   Installation Complete! Launching HuskyNote...
echo ========================================================
echo.

call npm run dev
