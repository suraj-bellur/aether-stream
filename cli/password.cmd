@echo off
rem @group Storage
rem @help Copy a sub-account password to the clipboard, or print it with --show
rem @args public or private [--show]
rem @opt public or private          whose password (required); it is copied to the clipboard
rem @opt --show                     print it on screen instead
rem @raw  .\infra\tfs output -raw public_password | clip
rem @raw  .\infra\tfs output -raw private_password                 prints it
setlocal
call "%AETHER_LIB%\box.cmd" %1
if errorlevel 1 exit /b 1
if /i "%~2"=="--show" (
    call "%AETHER_INFRA%\tfs.cmd" output -raw %~1_password
    echo.
    exit /b 0
)
call "%AETHER_LIB%\clipboard.cmd" %1
exit /b %ERRORLEVEL%
