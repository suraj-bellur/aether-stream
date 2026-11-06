@echo off
rem @group Server
rem @help Wait until the server's first-boot setup is done, then say whether the site is ready
rem @raw  ssh <target> cloud-init status --wait
rem @raw  ssh <target> test -f /var/lib/aether-stream-ready      exit code 0 = the site started
setlocal
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1
echo Waiting for %AETHER_TARGET%. First boot takes 5 to 10 minutes; SSH refusals at the start are normal.
set /a N=0

:try
set /a N+=1
%AETHER_SSH% %AETHER_TARGET% "cloud-init status --wait >/dev/null 2>&1; cloud-init status; if test -f /var/lib/aether-stream-ready; then echo 'site: ready'; else echo 'site: NOT ready, see: .\aether logs setup'; exit 1; fi"
if not errorlevel 255 goto :finished
if %N% geq 60 (
    echo Gave up after 60 tries. Check the server in the Hetzner console, or run:  .\aether ssh
    exit /b 1
)
echo   not reachable yet, try %N% of 60, next in 15 seconds
ping -n 16 127.0.0.1 >nul
goto :try

:finished
exit /b %ERRORLEVEL%
