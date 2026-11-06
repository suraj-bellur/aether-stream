@echo off
rem @group Storage
rem @help List files in a library: through the server when it runs, else straight from the box
rem @args <public or private> [folder] [-y]
rem @opt public or private          which library (required)
rem @opt a folder name              optional: list inside that folder
rem @opt -y                         skip the question when it has to open the box first
rem @raw  ssh <target> ls -la /media/videos                    server running, public library
rem @raw  ssh <target> ls -la /media/private                   server running, private library
rem @raw  .\infra\tfs apply -var="external_access=true"         no server: open access first
rem @raw  ssh -p 23 <public_user>@<public_host> ls -la          password from  .\aether password public
rem @raw  .\infra\tfs apply                                    then close access again
setlocal
set "LIB=%~1"
set "SUB=%~2"
call "%AETHER_LIB%\box.cmd" %1
if errorlevel 1 exit /b 1

call "%AETHER_LIB%\server.cmd" quiet
if errorlevel 1 goto :box
set "MNT=/media/videos"
if /i "%LIB%"=="private" set "MNT=/media/private"
echo Listing through the server: %MNT%/%SUB%
%AETHER_SSH% %AETHER_TARGET% "ls -la '%MNT%/%SUB%'"
exit /b %ERRORLEVEL%

:box
echo No server is running, so this lists straight from the Storage Box.
echo That needs external access open for a moment, and the %LIB% password.
call "%AETHER_LIB%\confirm.cmd" "Go ahead?"
if errorlevel 1 exit /b 1
call "%AETHER_LIB%\access.cmd" open
if errorlevel 1 exit /b 1
call "%AETHER_LIB%\clipboard.cmd" %LIB%
ssh -p 23 -o StrictHostKeyChecking=accept-new %AETHER_BOX_USER%@%AETHER_BOX_HOST% ls -la %SUB%
set "RC=%ERRORLEVEL%"
call "%AETHER_LIB%\clipboard.cmd" clear
call "%AETHER_LIB%\access.cmd" close
exit /b %RC%
