@echo off
rem @group Server
rem @help Restart the containers, or one of them, without rebuilding the server
rem @args [service name, for example backend]
rem @raw  ssh <target> "cd /opt/aether-stream && docker compose restart"
rem @raw  ssh <target> "cd /opt/aether-stream && docker compose ps"
setlocal
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1
%AETHER_SSH% %AETHER_TARGET% "cd /opt/aether-stream && docker compose restart %* && docker compose ps"
exit /b %ERRORLEVEL%
