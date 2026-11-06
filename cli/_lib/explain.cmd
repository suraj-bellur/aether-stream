@echo off
rem Prints the raw commands of one command file (its "rem @raw" lines), with the real
rem server address and Storage Box usernames filled in where they exist. Runs nothing else.
rem Usage: call explain.cmd <command> [nofill]
setlocal DisableDelayedExpansion
set "FILE=%AETHER_CLI%\%~1.cmd"
if not exist "%FILE%" (
    echo Unknown command: %~1
    exit /b 1
)
set "TGT="
set "IP="
set "PU="
set "PH="
set "QU="
set "QH="
if /i "%~2"=="nofill" goto :print
findstr /c:"<target>" /c:"<ip>" "%FILE%" >nul && call "%AETHER_LIB%\server.cmd" quiet && (
    call set "TGT=%%AETHER_TARGET%%"
    call set "IP=%%AETHER_IP%%"
)
findstr /c:"<public_" "%FILE%" >nul && call "%AETHER_LIB%\box.cmd" public quiet && (
    call set "PU=%%AETHER_BOX_USER%%"
    call set "PH=%%AETHER_BOX_HOST%%"
)
findstr /c:"<private_" "%FILE%" >nul && call "%AETHER_LIB%\box.cmd" private quiet && (
    call set "QU=%%AETHER_BOX_USER%%"
    call set "QH=%%AETHER_BOX_HOST%%"
)

:print
set "HELP="
for /f "tokens=2,*" %%a in ('findstr /b /c:"rem @help " "%FILE%"') do set "HELP=%%b"
echo %~1: %HELP%
setlocal EnableDelayedExpansion
for /f "tokens=2,*" %%a in ('findstr /b /c:"rem @raw " "%FILE%"') do (
    set "L=%%b"
    if defined TGT set "L=!L:<target>=%TGT%!"
    if defined IP set "L=!L:<ip>=%IP%!"
    if defined PU set "L=!L:<public_user>=%PU%!"
    if defined PH set "L=!L:<public_host>=%PH%!"
    if defined QU set "L=!L:<private_user>=%QU%!"
    if defined QH set "L=!L:<private_host>=%QH%!"
    echo   !L!
)
endlocal
exit /b 0
