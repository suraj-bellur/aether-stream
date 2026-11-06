@echo off
rem @group Session
rem @help Destroy the server, then show what is still billing (the Storage Box stays)
rem @args [-y]
rem @opt -y                         skip the 'type yes' question
rem @raw  .\infra\tf destroy
rem @raw  Hetzner console, Servers page: check that no server is left
setlocal
set "AUTO="
if defined AETHER_YES set "AUTO=-auto-approve"
call "%AETHER_INFRA%\tf.cmd" destroy %AUTO% %*
if errorlevel 1 exit /b 1
echo.
call "%AETHER_CLI%\status.cmd"
exit /b 0
