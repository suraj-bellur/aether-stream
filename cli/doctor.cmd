@echo off
rem @group Setup
rem @help Check the tools, the SSH key, the secret files and Terraform, names only, never contents
rem @raw  where terraform ssh clip
rem @raw  wsl -e sh -c "command -v rsync ssh"
rem @raw  dir .passwords
setlocal
set "BAD=0"
echo Tools on Windows
for %%t in (terraform ssh ssh-keygen clip powershell wsl) do (
    where %%t >nul 2>&1 && (echo   ok       %%t) || (echo   MISSING  %%t & set "BAD=1")
)
echo Tools in WSL, for upload
for %%t in (rsync ssh) do (
    wsl -e sh -c "command -v %%t" >nul 2>&1 && (echo   ok       %%t) || (echo   MISSING  %%t, install it in WSL: sudo apt install %%t & set "BAD=1")
)

echo SSH key the server trusts
if exist "%USERPROFILE%\.ssh\id_ed25519.pub" (echo   ok       %USERPROFILE%\.ssh\id_ed25519.pub) else (echo   MISSING  %USERPROFILE%\.ssh\id_ed25519.pub, create it with: ssh-keygen -t ed25519 & set "BAD=1")

echo Secret files in .passwords\, checked by name only
call :need aether-stream-hetzner-api-token "always"
call :need aether-stream-public-site-password "the public site"
call :need aether-stream-cloudflare-public-tunnel-token "enable_tunnel"
call :need aether-stream-private-site-password "enable_private"
call :need aether-stream-cloudflare-private-tunnel-token "enable_private with enable_tunnel"
call :optional aether-stream-public-hostname ".\aether site"
call :optional aether-stream-private-hostname ".\aether site private"

echo Terraform
for %%s in (storage server) do (
    if exist "%AETHER_INFRA%\%%s\.terraform\" (echo   ok       infra\%%s is initialised) else (echo   MISSING  infra\%%s is not initialised: terraform -chdir=infra\%%s init & set "BAD=1")
)
call "%AETHER_LIB%\box.cmd" public quiet
if errorlevel 1 (echo   note     no Storage Box in the state yet: .\aether storage create) else (echo   ok       Storage Box %AETHER_BOX_HOST%)

echo.
if "%BAD%"=="1" (
    echo Something is missing, see the MISSING lines above.
    exit /b 1
)
echo All checks passed.
exit /b 0

:need
if exist "%AETHER_SECRETS%\%~1" (
    echo   ok       %~1
) else (
    echo   MISSING  %~1, needed for %~2
    set "BAD=1"
)
exit /b 0

:optional
if exist "%AETHER_SECRETS%\%~1" (
    echo   ok       %~1
) else (
    echo   optional %~1, used by %~2
)
exit /b 0
