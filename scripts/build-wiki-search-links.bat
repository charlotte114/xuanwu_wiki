@echo off
cd /d "%~dp0\.."
py -3 scripts\build-wiki-search-links.py
if errorlevel 1 python scripts\build-wiki-search-links.py
pause
