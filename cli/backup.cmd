@echo off
rem @group Storage
rem @help Back up the Terraform state files, which hold the generated passwords, into .passwords\
rem @raw  copy infra\storage\terraform.tfstate .passwords\storage.tfstate.bak
rem @raw  copy infra\server\terraform.tfstate .passwords\server.tfstate.bak
rem A state with no resources is never copied, so an empty or lost state cannot overwrite a good backup.
setlocal
set "COPIED="
call :one storage
call :one server
if not defined COPIED (
    echo Nothing backed up: no state with resources in it.
    exit /b 1
)
exit /b 0

:one
set "STATE=%AETHER_INFRA%\%~1\terraform.tfstate"
if not exist "%STATE%" (
    echo   skipped  %~1: no state file
    exit /b 0
)
findstr /c:"\"mode\":" "%STATE%" >nul
if errorlevel 1 (
    echo   skipped  %~1: the state is empty, nothing to back up
    exit /b 0
)
copy /y "%STATE%" "%AETHER_SECRETS%\%~1.tfstate.bak" >nul
if errorlevel 1 (
    echo   FAILED   %~1: could not copy to .passwords\%~1.tfstate.bak
    exit /b 0
)
echo   ok       %~1 state backed up to .passwords\%~1.tfstate.bak
set "COPIED=1"
exit /b 0
