@echo off
rem End a session: destroy the server (the Storage Box stays), then show what is still running.
rem Usage:   .\infra\down
rem Terraform shows the plan and asks you to type yes.
call "%~dp0tf.cmd" destroy %*
if errorlevel 1 exit /b %ERRORLEVEL%
echo.
call "%~dp0status.cmd"
