@echo off
rem Runs Terraform in infra\server with the Hetzner token loaded for this one command.
rem Usage (from any terminal):   .\infra\tf plan     .\infra\tf apply     .\infra\tf destroy
rem The token comes from .passwords\ (git-ignored) and is not left in your shell.
setlocal

set "TOKEN_FILE=%~dp0..\.passwords\aether-stream-api-token"
if not exist "%TOKEN_FILE%" (
    echo Token file not found: %TOKEN_FILE%
    exit /b 1
)

set /p TF_VAR_hcloud_token=<"%TOKEN_FILE%"
if not defined TF_VAR_hcloud_token (
    echo Token file is empty: %TOKEN_FILE%
    exit /b 1
)

if not defined TF_STACK set "TF_STACK=server"
terraform -chdir="%~dp0%TF_STACK%" %*
exit /b %ERRORLEVEL%
