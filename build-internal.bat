@echo off
setlocal EnableExtensions
cd /d "%~dp0"

py -3 "%~dp0scripts\build-internal-compendium.py"
if errorlevel 1 (
  echo.
  echo Build failed. Need game-data\doc.json - run import-game-data.bat first.
  pause
  exit /b 1
)

echo.
echo Done.
pause
exit /b 0
