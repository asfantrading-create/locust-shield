@echo off
cd /d "%~dp0"
node daily-run.mjs >> reportsun-log.txt 2>&1
