@echo off
rem Reads the "rem @group", "rem @help" and "rem @args" lines of every command file in cli\
rem and sets G_<name>, H_<name> and A_<name> for the caller (no setlocal on purpose).
rem Three findstr runs in total, so the menu and help stay quick.
pushd "%AETHER_CLI%"
for /f "tokens=1,* delims=:" %%a in ('findstr /b /c:"rem @group " *.cmd') do (
    for /f "tokens=2,*" %%x in ("%%b") do set "G_%%~na=%%y"
)
for /f "tokens=1,* delims=:" %%a in ('findstr /b /c:"rem @help " *.cmd') do (
    for /f "tokens=2,*" %%x in ("%%b") do set "H_%%~na=%%y"
)
for /f "tokens=1,* delims=:" %%a in ('findstr /b /c:"rem @args " *.cmd') do (
    for /f "tokens=2,*" %%x in ("%%b") do set "A_%%~na=%%y"
)
popd
set "AETHER_GROUPS=Session Server Storage Setup"
exit /b 0
