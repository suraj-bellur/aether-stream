@echo off
rem @group Storage
rem @help Log in to a library on the Storage Box: a shell, sftp, or one command (opens and closes access for you)
rem @args <public or private> [sftp or a command]
rem @eg public
rem @opt public or private          which library (required)
rem @opt (nothing)                  a shell on the box; only a few commands work there, type exit to leave
rem @opt sftp                       an sftp session instead, to browse, get and put files
rem @opt a command                  run just that one and come back, for example: ls -la   or   du -sh Holidays
rem @opt -y                         skip the question
rem @raw  .\infra\tfs apply -var="external_access=true"        open it, unless it is open already
rem @raw  .\infra\tfs output -raw public_password | clip       then paste it at the password prompt
rem @raw  ssh -p 23 <public_user>@<public_host>                a shell; add a command at the end to run only that
rem @raw  sftp -P 23 <public_user>@<public_host>               sftp (capital P)
rem @raw  .\infra\tfs apply                                    close it again, only if it was closed before
setlocal DisableDelayedExpansion
set "LIB=%~1"
if /i not "%LIB%"=="public" if /i not "%LIB%"=="private" (
    echo Say which library: public or private. For example:  .\aether connect public
    exit /b 1
)
call "%AETHER_LIB%\box.cmd" %LIB%
if errorlevel 1 exit /b 1

rem Everything after the library: nothing = shell, "sftp" alone = sftp, anything else = one command.
set "MODE=%~2"
set "REST="
set /a N=0
shift
:collect
if "%~1"=="" goto :collected
set REST=%REST% %1
set /a N+=1
shift
goto :collect
:collected

rem Is external access open already? If so it is left open afterwards, because someone opened it on purpose.
set "ACC=closed"
set "AETHER_PS=$b = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes); if ($b.Count -gt 0 -and $b[0].access_settings.reachable_externally) { 'open' } else { 'closed' }"
for /f "usebackq delims=" %%i in (`call "%AETHER_LIB%\api.cmd" 2^>nul`) do set "ACC=%%i"

echo.
echo  Library:  %LIB%
echo  Login:    %AETHER_BOX_USER%@%AETHER_BOX_HOST%
if "%ACC%"=="open" (
    echo  External access is already open, so it stays open when you leave.
) else (
    echo  External access is opened now and closed again when you leave.
)
call "%AETHER_LIB%\confirm.cmd" "Connect?"
if errorlevel 1 exit /b 1

set "WEOPENED="
if not "%ACC%"=="open" (
    call "%AETHER_LIB%\access.cmd" open
    if errorlevel 1 exit /b 1
    set "WEOPENED=1"
)
call "%AETHER_LIB%\clipboard.cmd" %LIB%

if "%N%"=="0" goto :shell
if "%N%"=="1" if /i "%MODE%"=="sftp" goto :sftp
goto :command

:shell
echo.
echo  You are logging in to a restricted shell. These work: ls cd pwd du df tree mkdir rm rmdir mv cp cat.
echo  Type exit to leave. Deleted files cannot be recovered.
ssh -p 23 -o StrictHostKeyChecking=accept-new %AETHER_BOX_USER%@%AETHER_BOX_HOST%
set "RC=%ERRORLEVEL%"
goto :after

:sftp
echo.
echo  Inside sftp: ls, cd, get, put, rm, rmdir, mkdir, and quit to leave.
sftp -P 23 -o StrictHostKeyChecking=accept-new %AETHER_BOX_USER%@%AETHER_BOX_HOST%
set "RC=%ERRORLEVEL%"
goto :after

:command
ssh -p 23 -o StrictHostKeyChecking=accept-new %AETHER_BOX_USER%@%AETHER_BOX_HOST% %REST%
set "RC=%ERRORLEVEL%"

:after
call "%AETHER_LIB%\clipboard.cmd" clear
if defined WEOPENED call "%AETHER_LIB%\access.cmd" close
if "%RC%"=="255" (
    echo.
    echo  The connection failed. If it said the host key changed, run:  .\aether forget-host box
    echo  If it was refused, wait a minute after opening access and try again.
)
exit /b %RC%
