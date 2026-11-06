@echo off
rem @group Setup
rem @help Print the raw commands behind every action, to do the same without this CLI
rem @args [command]
rem @opt a command name           show only that command, for example: upload
rem @raw  every command file lists its raw commands in its own  rem @raw  lines
setlocal DisableDelayedExpansion
if not "%~1"=="" (
    call "%AETHER_LIB%\explain.cmd" %~1
    exit /b
)
echo Raw commands behind every  .\aether  action. Run them from the repo root.
echo.
echo  .\infra\tf  ARGS    =  terraform -chdir=infra\server  ARGS   with the secrets loaded
echo  .\infra\tfs ARGS    =  terraform -chdir=infra\storage ARGS   with the secrets loaded
echo    infra\tf.cmd sets TF_VAR_hcloud_token and the other TF_VAR_* values from the files in
echo    .passwords\ for that one command. Without it, set them yourself first, for example
echo    set /p TF_VAR_hcloud_token=^<.passwords\aether-stream-hetzner-api-token
echo  ^<target^>  = deploy@SERVER-IP, from  .\infra\tf output ssh_command
echo  ^<public_user^>, ^<public_host^>  = from  .\infra\tfs output public_username  and  public_host
echo  ^<hetzner token^>  = the contents of .passwords\aether-stream-hetzner-api-token
echo  To see one command with the real values filled in:  .\aether manual upload,  or  .\aether upload --explain
call "%AETHER_LIB%\catalog.cmd"
for %%g in (%AETHER_GROUPS%) do (
    echo.
    echo ===== %%g =====
    for %%f in ("%AETHER_CLI%\*.cmd") do (
        call :one "%%~nf" "%%g"
    )
)
exit /b 0

:one
call set "G=%%G_%~1%%"
if not "%G%"=="%~2" exit /b 0
echo.
call "%AETHER_LIB%\explain.cmd" %~1 nofill
exit /b 0
