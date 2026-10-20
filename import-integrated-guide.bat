@echo off
chcp 65001 >nul
py -3 "%~dp0scripts\import-xuanwu-guide-docx.py" "%~1"
if errorlevel 1 pause
