@echo off
rem @group Server
rem @help Remove an old SSH host key on Windows and in WSL, after a rebuild or a new box
rem @args [ip or host, or box]
rem @raw  ssh-keygen -R <ip>                                     Windows
rem @raw  wsl ssh-keygen -R <ip>                                 WSL
rem @raw  wsl ssh-keygen -R [<public_host>]:23                   box, as used by rsync
rem @raw  wsl ssh-keygen -R [<private_host>]:23
setlocal
if /i "%~1"=="box" goto :box
set "HOST=%~1"
if not defined HOST (
    call "%AETHER_LIB%\server.cmd"
    if errorlevel 1 (
        echo Or say which host, for example:  .\aether forget-host 203.0.113.10
        exit /b 1
    )
)
if not defined HOST set "HOST=%AETHER_IP%"
call :forget "%HOST%"
exit /b 0

:box
for %%l in (public private) do (
    call "%AETHER_LIB%\box.cmd" %%l quiet && call :forget "[%%AETHER_BOX_HOST%%]:23"
)
exit /b 0

:forget
echo Forgetting %~1
ssh-keygen -R "%~1" 2>nul
wsl -e ssh-keygen -R "%~1" 2>nul
exit /b 0
