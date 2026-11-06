@echo off
rem @group Server
rem @help Pull the latest code on the running server and rebuild its containers, no new server
rem @raw  ssh <target> "cd /opt/aether-stream && git pull --ff-only"
rem @raw  ssh <target> "cd /opt/aether-stream && docker compose up -d --build $(docker compose ps --services)"
rem @raw  changes to infra\ or the cloud-init template need  .\aether rebuild  instead
setlocal
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1
echo Pushed your commits? The server pulls from GitHub, not from this PC.
%AETHER_SSH% %AETHER_TARGET% "set -e; cd /opt/aether-stream; git pull --ff-only; s=$(docker compose ps --services); case $s in '') echo 'No containers are running, so there is nothing to update.'; exit 1;; esac; echo rebuilding: $s; docker compose up -d --build $s; docker compose ps"
exit /b %ERRORLEVEL%
