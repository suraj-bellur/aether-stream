@echo off
rem Numbered menu, built from the cli\ folder: every command file appears here by itself.
rem Each choice runs  .\aether <command> [arguments], so menu and direct commands behave the same.
setlocal EnableDelayedExpansion
call "%AETHER_LIB%\catalog.cmd"

:menu
echo.
echo  ===== Aether Stream =====
call "%AETHER_ROOT%aether.cmd" status
set /a I=0
for %%g in (%AETHER_GROUPS%) do (
    echo.
    echo  %%g
    for %%f in ("%AETHER_CLI%\*.cmd") do (
        if "!G_%%~nf!"=="%%g" (
            set /a I+=1
            set "M_!I!=%%~nf"
            set "N=    !I!"
            set "N=!N:~-3!  %%~nf                    "
            echo  !N:~0,18! !H_%%~nf!
        )
    )
)
echo.
set "C="
set /p "C= Number, then Enter (just Enter to exit): "
if not defined C exit /b 0
set "C=!C: =!"
if not defined C exit /b 0
if "!C!"=="0" exit /b 0
set "NAME="
for /f "delims=0123456789" %%x in ("!C!") do set "C=bad"
for %%n in ("!C!") do set "NAME=!M_%%~n!"
if not defined NAME (
    echo  Not a number on the list.
    goto :menu
)
set "HINT="
for %%n in ("!NAME!") do set "HINT=!A_%%~n!"
set "ARGS="
if defined HINT (
    set "NEEDS="
    set "T=!HINT:<=!"
    if not "!T!"=="!HINT!" set "NEEDS=1"
    echo.
    echo  Options for !NAME!:
    for /f "tokens=2,*" %%a in ('findstr /b /c:"rem @opt " "%AETHER_CLI%\!NAME!.cmd"') do (
        set "L=%%b"
        echo      !L!
    )
    echo.
    set "EG="
    for %%n in ("!NAME!") do set "EG=!E_%%~n!"
    if defined EG echo  Example, type it like this:  !EG!
    if defined NEEDS (
        echo  Items shown in ^<angle brackets^> are required. Pressing Enter alone will not work.
    ) else (
        echo  Everything here is optional. Type what you want, or just press Enter for the normal behaviour.
    )
    set /p "ARGS= > "
)
echo.
call "%AETHER_ROOT%aether.cmd" !NAME! !ARGS!
echo.
pause
goto :menu
