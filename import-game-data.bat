@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Edit this line if your game export is elsewhere:
set "SRC=D:\QQ\data\玄武2"

py -3 "%~dp0scripts\import-game-data.py" "%SRC%"
if errorlevel 1 (
  echo.
  echo Import failed.
  pause
  exit /b 1
)

echo.
echo Next: build-characters.bat
pause
exit /b 0
