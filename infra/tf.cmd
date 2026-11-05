@echo off
rem Runs Terraform in infra\server with the Hetzner token loaded for this one command.
rem Usage (from any terminal):   .\infra\tf plan     .\infra\tf apply     .\infra\tf destroy
rem The token comes from .passwords\ (git-ignored) and is not left in your shell.
setlocal

set "TOKEN_FILE=%~dp0..\.passwords\aether-stream-hetzner-api-token"
if not exist "%TOKEN_FILE%" (
    echo Token file not found: %TOKEN_FILE%
    exit /b 1
)

set /p TF_VAR_hcloud_token=<"%TOKEN_FILE%"
if not defined TF_VAR_hcloud_token (
    echo Token file is empty: %TOKEN_FILE%
    exit /b 1
)

rem Optional: the site login password you chose (git-ignored file). Only the server stack uses it.
set "SITE_PW_FILE=%~dp0..\.passwords\aether-stream-public-site-password"
if exist "%SITE_PW_FILE%" set /p TF_VAR_site_password=<"%SITE_PW_FILE%"

rem Optional: the Cloudflare tunnel token of the public site (git-ignored file).
rem It is only used when enable_tunnel is true; the server stack ignores it otherwise.
set "TUNNEL_FILE=%~dp0..\.passwords\aether-stream-cloudflare-public-tunnel-token"
if exist "%TUNNEL_FILE%" set /p TF_VAR_tunnel_token=<"%TUNNEL_FILE%"

rem Optional, private site only (used when enable_private is true): its own password and tunnel token.
set "PRIVATE_PW_FILE=%~dp0..\.passwords\aether-stream-private-site-password"
if exist "%PRIVATE_PW_FILE%" set /p TF_VAR_private_site_password=<"%PRIVATE_PW_FILE%"
set "PRIVATE_TUNNEL_FILE=%~dp0..\.passwords\aether-stream-cloudflare-private-tunnel-token"
if exist "%PRIVATE_TUNNEL_FILE%" set /p TF_VAR_private_tunnel_token=<"%PRIVATE_TUNNEL_FILE%"

if not defined TF_STACK set "TF_STACK=server"
terraform -chdir="%~dp0%TF_STACK%" %*
exit /b %ERRORLEVEL%
