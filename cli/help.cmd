@echo off
rem @group Setup
rem @help List every command, or explain one: .\aether help up
rem @args [command]
rem @opt a command name           explain that command: what it does, how to call it, its options
rem @raw  every command is one file in cli\, its first lines say what it does
setlocal EnableDelayedExpansion
call "%AETHER_LIB%\catalog.cmd"
if not "%~1"=="" goto :one
echo Usage:  .\aether [command] [arguments]       no command opens the menu
echo Options for every command:  -y  answers yes to questions,  --explain  shows the raw commands without running them
echo Raw commands for everything, to work without this CLI:  .\aether manual
echo One command in detail (what it does, its options):  .\aether help ^<command^>   or   .\aether ^<command^> --help
set "PAD=                                            "
for %%g in (%AETHER_GROUPS%) do (
    echo.
    echo %%g
    for %%f in ("%AETHER_CLI%\*.cmd") do (
        if "!G_%%~nf!"=="%%g" (
            set "N=%%~nf"
            if defined A_%%~nf set "N=%%~nf !A_%%~nf!"
            set "P=!N!!PAD!"
            if "!N:~38!"=="" (
                echo   !P:~0,40!!H_%%~nf!
            ) else (
                echo   !N!
                echo   !PAD:~0,40!!H_%%~nf!
            )
        )
    )
)
exit /b 0

:one
set "NAME=%~1"
if not exist "%AETHER_CLI%\%NAME%.cmd" (
    echo Unknown command: %NAME%
    echo Run  .\aether help  to see the list.
    exit /b 1
)
set "H=!H_%NAME%!"
set "A=!A_%NAME%!"
echo !NAME!: !H!
echo.
if defined A (echo Usage:  .\aether !NAME! !A!) else (echo Usage:  .\aether !NAME!)
echo.
set "ANYOPT="
for /f "tokens=2,*" %%a in ('findstr /b /c:"rem @opt " "%AETHER_CLI%\!NAME!.cmd"') do (
    if not defined ANYOPT echo Options:
    set "ANYOPT=1"
    set "L=%%b"
    echo     !L!
)
if not defined ANYOPT echo This command takes no options. Just run it.
set "EG=!E_%NAME%!"
if defined EG echo.& echo Example:  .\aether !NAME! !EG!
set "T=!A:<=!"
if not "!T!"=="!A!" echo.& echo Items shown in ^<angle brackets^> are required. The others are optional.
echo.
echo The raw commands behind it:  .\aether manual !NAME!
echo What it would run, without running it:  .\aether !NAME! --explain
exit /b 0
