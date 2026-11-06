@echo off
rem @group Setup
rem @help List every command
rem @raw  every command is one file in cli\, its first lines say what it does
setlocal EnableDelayedExpansion
call "%AETHER_LIB%\catalog.cmd"
echo Usage:  .\aether [command] [arguments]       no command opens the menu
echo Options for every command:  -y  answers yes to questions,  --explain  shows the raw commands without running them
echo Raw commands for everything, to work without this CLI:  .\aether manual
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
