@echo off
rem @group Server
rem @help Log in to the server as deploy
rem @raw  ssh <target>
setlocal
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1
%AETHER_SSH% %AETHER_TARGET%
exit /b %ERRORLEVEL%
