@echo off
rem Usage: call clipboard.cmd public|private    copies that sub-account's password to the clipboard
rem        call clipboard.cmd clear             empties the clipboard
rem The password goes straight from Terraform to the clipboard and is never printed.
if /i "%~1"=="clear" (
    type nul | clip
    exit /b 0
)
if /i not "%~1"=="public" if /i not "%~1"=="private" (
    echo Say which library: public or private.
    exit /b 1
)
call "%AETHER_INFRA%\tfs.cmd" output -raw %~1_password 2>nul | clip
echo The %~1 password is on the clipboard. Paste it at the password prompt (right-click, or Ctrl+Shift+V).
exit /b 0
