@echo off
rem @group Server
rem @help Show the setup log, the full first-boot log, or one container's log
rem @args [setup or boot or service name, for example backend] [-f]
rem @opt (nothing) or setup         the first-boot setup log
rem @opt boot                       the full first-boot log
rem @opt a service name             one container: backend, frontend, nginx, cloudflared,
rem @opt                            backend-private, nginx-private, cloudflared-private
rem @opt -f after the service       keep following the log until you press Ctrl+C
rem @raw  ssh <target> sudo grep aether-setup /var/log/cloud-init-output.log         setup, the default
rem @raw  ssh <target> sudo tail -n 200 /var/log/cloud-init-output.log               boot
rem @raw  ssh <target> "cd /opt/aether-stream && docker compose logs --tail 100 backend"
rem @raw  services: backend frontend nginx cloudflared backend-private nginx-private cloudflared-private
setlocal
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1
set "WHAT=%~1"
if "%WHAT%"=="" set "WHAT=setup"
if /i "%WHAT%"=="setup" (
    %AETHER_SSH% %AETHER_TARGET% "sudo grep aether-setup /var/log/cloud-init-output.log"
    goto :done
)
if /i "%WHAT%"=="boot" (
    %AETHER_SSH% %AETHER_TARGET% "sudo tail -n 200 /var/log/cloud-init-output.log"
    goto :done
)
%AETHER_SSH% %AETHER_TARGET% "cd /opt/aether-stream && docker compose logs --tail 100 %~2 %WHAT%"

:done
exit /b %ERRORLEVEL%
