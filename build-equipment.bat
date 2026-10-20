@echo off
setlocal EnableExtensions
cd /d "%~dp0"

py -3 "%~dp0scripts\build-equipment-compendium.py"
if errorlevel 1 (
  echo.
  echo Build failed. Run import-game-data.bat first for doc + res_icon.
  pause
  exit /b 1
)

echo.
echo Done.
pause
exit /b 0
