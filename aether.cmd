@echo off
rem Aether Stream command line.
rem   .\aether                  numbered menu
rem   .\aether help             every command, with a one-line description
rem   .\aether manual           the raw commands behind every action (to work without this CLI)
rem   .\aether <command> [args] run one command, for example  .\aether up
rem Options for any command:  -y  answers yes to confirmations,  --explain  prints what it would run.
rem Each command is one file in cli\. Adding a file adds a command; this file never changes.
setlocal EnableExtensions DisableDelayedExpansion

set "AETHER_ROOT=%~dp0"
set "AETHER_CLI=%~dp0cli"
set "AETHER_LIB=%~dp0cli\_lib"
set "AETHER_INFRA=%~dp0infra"
set "AETHER_SECRETS=%~dp0.passwords"

if "%~1"=="" (
    call "%AETHER_LIB%\menu.cmd"
    goto :done
)

set "AETHER_CMD=%~1"
if /i "%AETHER_CMD%"=="-h" set "AETHER_CMD=help"
if /i "%AETHER_CMD%"=="--help" set "AETHER_CMD=help"
if "%AETHER_CMD:~0,1%"=="_" goto :unknown
if not exist "%AETHER_CLI%\%AETHER_CMD%.cmd" goto :unknown

rem Everything after the command name, with -y / --yes / --explain taken out.
setlocal EnableDelayedExpansion
set "ALL= %* "
set "T=!ALL:* %~1 =!"
set "T= !T! "
set "YES="
set "EXPLAIN="
set "U=!T: -y = !"
if not "!U!"=="!T!" (set "YES=1" & set "T=!U!")
set "U=!T: --yes = !"
if not "!U!"=="!T!" (set "YES=1" & set "T=!U!")
set "U=!T: --explain = !"
if not "!U!"=="!T!" (set "EXPLAIN=1" & set "T=!U!")
endlocal & set "AETHER_YES=%YES%" & set "AETHER_EXPLAIN=%EXPLAIN%" & set "AETHER_ARGS=%T%"

if defined AETHER_EXPLAIN goto :explain
call "%AETHER_CLI%\%AETHER_CMD%.cmd" %AETHER_ARGS%
goto :done

:explain
call "%AETHER_LIB%\explain.cmd" %AETHER_CMD%
goto :done

:unknown
echo Unknown command: %~1
echo.
call "%AETHER_CLI%\help.cmd"
exit /b 1

:done
exit /b %ERRORLEVEL%
