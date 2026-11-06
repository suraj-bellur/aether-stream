@echo off
rem Runs the PowerShell code in AETHER_PS with the Hetzner token in HCLOUD_TOKEN, for this call only.
rem The code is read from the environment, so cmd never re-parses its | > and quotes.
rem The calling command sets AETHER_PS with single-quoted PowerShell strings only.
setlocal
set "TOKEN_FILE=%AETHER_SECRETS%\aether-stream-hetzner-api-token"
if not exist "%TOKEN_FILE%" (
    echo Token file not found: %TOKEN_FILE%
    exit /b 1
)
set /p HCLOUD_TOKEN=<"%TOKEN_FILE%"
powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference = 'Stop'; $H = @{ Authorization = 'Bearer ' + $env:HCLOUD_TOKEN }; try { Invoke-Expression $env:AETHER_PS } catch { 'Hetzner API error: ' + $_.Exception.Message; exit 1 }"
exit /b %ERRORLEVEL%
