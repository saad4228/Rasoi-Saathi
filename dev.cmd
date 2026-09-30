@echo off
rem Double-click (or run "dev.cmd -Check") to check the setup and start RasoiSaathi.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
if "%~1"=="" pause
