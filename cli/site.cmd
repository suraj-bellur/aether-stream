@echo off
rem @group Server
rem @help Open the site: the public hostname when the tunnel is on, else an SSH tunnel to localhost
rem @args [private] [local]
rem @opt (nothing)                  open the public site
rem @opt private                    open the private site
rem @opt local                      use an SSH tunnel to localhost, not the public hostname
rem @raw  start https://<your public hostname>             hostname from .passwords\aether-stream-public-hostname
rem @raw  ssh -N -L 8080:localhost:80 <target>             local, then open http://localhost:8080
rem @raw  ssh -N -L 8081:localhost:81 <target>             private local, then open http://localhost:8081
setlocal
set "LIB=public"
set "LOCAL="
for %%a in (%*) do (
    if /i "%%~a"=="private" set "LIB=private"
    if /i "%%~a"=="local" set "LOCAL=1"
)
call "%AETHER_LIB%\server.cmd"
if errorlevel 1 exit /b 1

if "%LIB%"=="private" (
    set "LPORT=8081"
    set "RPORT=81"
) else (
    set "LPORT=8080"
    set "RPORT=80"
)
if "%LIB%"=="private" (
    set "ON="
    for /f "usebackq delims=" %%i in (`call "%AETHER_INFRA%\tf.cmd" output -raw private_enabled 2^>nul`) do set "ON=%%i"
)
if "%LIB%"=="private" if not "%ON%"=="true" (
    echo The private site is switched off on this server: enable_private = false.
    exit /b 1
)
if defined LOCAL goto :tunnel

set "TUN="
for /f "usebackq delims=" %%i in (`call "%AETHER_INFRA%\tf.cmd" output -raw tunnel_enabled 2^>nul`) do set "TUN=%%i"
if not "%TUN%"=="true" goto :tunnel
set "HOST_FILE=%AETHER_SECRETS%\aether-stream-%LIB%-hostname"
if not exist "%HOST_FILE%" (
    echo The Cloudflare tunnel is on, but %HOST_FILE% does not exist.
    echo Put the %LIB% hostname in it, for example  stream.example.com , or use:  .\aether site %LIB% local
    exit /b 1
)
set /p SITE=<"%HOST_FILE%"
if /i not "%SITE:~0,4%"=="http" set "SITE=https://%SITE%"
echo Opening %SITE%
start "" "%SITE%"
exit /b 0

:tunnel
echo Starting the SSH tunnel in a new window. Close that window to stop it.
start "Aether %LIB% site tunnel" %AETHER_SSH% -N -L %LPORT%:localhost:%RPORT% %AETHER_TARGET%
ping -n 4 127.0.0.1 >nul
echo Opening http://localhost:%LPORT%
start "" "http://localhost:%LPORT%"
exit /b 0
