@echo off
rem Sets AETHER_BOX_USER and AETHER_BOX_HOST for one sub-account from the storage stack's state.
rem No setlocal on purpose: the values are for the calling command. Exit code 1 = no box.
rem Usage: call box.cmd public|private [quiet]
set "AETHER_BOX_USER="
set "AETHER_BOX_HOST="
if /i not "%~1"=="public" if /i not "%~1"=="private" (
    echo Say which library: public or private.
    exit /b 1
)
for /f "usebackq delims=" %%i in (`call "%AETHER_INFRA%\tfs.cmd" output -raw %~1_username 2^>nul`) do set "AETHER_BOX_USER=%%i"
for /f "usebackq delims=" %%i in (`call "%AETHER_INFRA%\tfs.cmd" output -raw %~1_host 2^>nul`) do set "AETHER_BOX_HOST=%%i"
if defined AETHER_BOX_USER if defined AETHER_BOX_HOST (
    echo %AETHER_BOX_HOST%| findstr /r /c:"^[A-Za-z0-9.-]*$" >nul && exit /b 0
)
set "AETHER_BOX_USER="
set "AETHER_BOX_HOST="
if /i not "%~2"=="quiet" echo No Storage Box in the Terraform state. Create one with:  .\aether storage create
exit /b 1
