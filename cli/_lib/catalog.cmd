@echo off
rem Reads the "rem @group", "rem @help", "rem @args" and "rem @eg" lines of every command file in cli\
rem and sets G_<name>, H_<name>, A_<name> and E_<name> for the caller (no setlocal on purpose).
rem Four findstr runs in total, so the menu and help stay quick.
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
for /f "tokens=1,* delims=:" %%a in ('findstr /b /c:"rem @eg " *.cmd') do (
    for /f "tokens=2,*" %%x in ("%%b") do set "E_%%~na=%%y"
)
popd
set "AETHER_GROUPS=Session Server Storage Setup"
exit /b 0
