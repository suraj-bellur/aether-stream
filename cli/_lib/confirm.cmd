@echo off
rem Usage: call confirm.cmd "Question"   exit code 0 = yes, 1 = no.
rem Answers yes by itself when the command was run with -y.
if defined AETHER_YES exit /b 0
choice /c yn /n /m "%~1 [y/n] "
if errorlevel 2 exit /b 1
exit /b 0
