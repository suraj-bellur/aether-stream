@echo off
rem Opens or closes external access to the Storage Box (whether your PC can reach it).
rem Usage: call access.cmd open|close     The Terraform log is only shown when it fails.
setlocal
if /i "%~1"=="open" (set "VALUE=true") else if /i "%~1"=="close" (set "VALUE=false") else (
    echo Say open or close.
    exit /b 1
)
set "LOG=%TEMP%\aether-access.log"
if "%VALUE%"=="true" (echo Opening external access to the Storage Box...) else (echo Closing external access to the Storage Box...)
call "%AETHER_INFRA%\tfs.cmd" apply -auto-approve -input=false -var="external_access=%VALUE%" > "%LOG%" 2>&1
if errorlevel 1 (
    type "%LOG%"
    echo Changing external access failed. Check the log above, then run:  .\aether access %~1
    exit /b 1
)
if "%VALUE%"=="true" (echo External access is OPEN. Close it with:  .\aether access close) else (echo External access is closed.)
exit /b 0
