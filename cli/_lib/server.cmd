@echo off
rem Sets AETHER_TARGET (deploy@ip), AETHER_IP and AETHER_SSH from the server stack's state.
rem No setlocal on purpose: the values are for the calling command. Exit code 1 = no server.
rem Usage: call server.cmd [quiet]
set "AETHER_TARGET="
set "AETHER_IP="
set "AETHER_SSH=ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
for /f "usebackq tokens=2" %%i in (`call "%AETHER_INFRA%\tf.cmd" output -raw ssh_command 2^>nul`) do set "AETHER_TARGET=%%i"
if defined AETHER_TARGET for /f "tokens=2 delims=@" %%i in ("%AETHER_TARGET%") do set "AETHER_IP=%%i"
if defined AETHER_IP echo %AETHER_IP%| findstr /r "^[0-9][0-9.]*$" >nul && exit /b 0
set "AETHER_TARGET="
set "AETHER_IP="
if /i not "%~1"=="quiet" echo No server in the Terraform state. Start one with:  .\aether up
exit /b 1
