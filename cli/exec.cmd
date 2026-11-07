@echo off
rem @group Server
rem @help Run one command on the server, for example  .\aether exec df -h
rem @args <command>
rem @eg df -h
rem @opt any command             what to run on the server, for example: df -h
rem @raw  ssh <target> <command>
setlocal
if "%~1"=="" (
    echo Say what to run, for example:  .\aether exec df -h
    exit /b 1
)
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1
%AETHER_SSH% %AETHER_TARGET% %*
exit /b %ERRORLEVEL%
