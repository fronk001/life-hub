@echo off
rem Double-click to open Life Hub on this laptop.
rem (The phone uses the online copy, https://fronk001.github.io/life-hub/;
rem both show the same data once signed in.)
title Life Hub
cd /d "%~dp0"

rem A copy left running from last time would still hold the port: stop it.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8520 " ^| findstr LISTENING') do taskkill /pid %%p /f >nul 2>nul

py tools\serve.py . 8520 --open
