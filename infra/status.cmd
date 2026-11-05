@echo off
rem Shows what is running in your Hetzner project, so a forgotten server is easy to spot.
rem Usage:   .\infra\status
rem Read-only. The API token is loaded from .passwords\ for this command only.
setlocal
set "TOKEN_FILE=%~dp0..\.passwords\aether-stream-hetzner-api-token"
if not exist "%TOKEN_FILE%" (
    echo Token file not found: %TOKEN_FILE%
    exit /b 1
)
set /p HCLOUD_TOKEN=<"%TOKEN_FILE%"
powershell -NoProfile -Command "$h = @{ Authorization = 'Bearer ' + $env:HCLOUD_TOKEN }; $s = @((Invoke-RestMethod -Headers $h -Uri 'https://api.hetzner.cloud/v1/servers').servers); $b = @((Invoke-RestMethod -Headers $h -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes); if ($s.Count -gt 0) { $s | ForEach-Object { 'SERVER  ' + $_.name + '  ' + $_.status + '  ' + $_.public_net.ipv4.ip + '  created ' + $_.created.Substring(0,16) + '  (about EUR 0.031 per hour while it exists)' } } else { 'SERVER  none (no hourly billing)' }; if ($b.Count -gt 0) { $b | ForEach-Object { 'BOX     ' + $_.name + '  ' + $_.storage_box_type.name + '  ' + $_.status + '  (EUR 3.20 per month)' } } else { 'BOX     none' }"
exit /b %ERRORLEVEL%
