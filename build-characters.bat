@echo off
setlocal EnableExtensions
cd /d "%~dp0"

py -3 "%~dp0scripts\build-character-compendium.py"
if errorlevel 1 (
  echo.
  echo Build failed. Need game-data under project: run import-game-data.bat first.
  echo Also: py -3 -m pip install Pillow
  pause
  exit /b 1
)

echo.
echo Done.
pause
exit /b 0
