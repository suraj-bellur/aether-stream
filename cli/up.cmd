@echo off
rem @group Session
rem @help Create the server and start the site (Terraform shows the plan first)
rem @args [-y] [-var=name=value]
rem @opt -y                         skip the 'type yes' question
rem @opt -var=enable_private=false  no private site, public site only
rem @opt -var=enable_tunnel=false   no Cloudflare tunnel (open the site with: site local)
rem @opt -var=name=value            change any other setting from infra\server\variables.tf
rem @raw  .\infra\tfs output box_host                 the Storage Box must exist first
rem @raw  .\infra\tf apply                            add -var="enable_private=false" or -var="enable_tunnel=false" for a smaller session
setlocal
call "%AETHER_LIB%\box.cmd" public quiet
if errorlevel 1 (
    echo There is no Storage Box yet, and the server needs it for its media mounts.
    echo Create it once with:  .\aether storage create
    exit /b 1
)
set "AUTO="
if defined AETHER_YES set "AUTO=-auto-approve"
call "%AETHER_INFRA%\tf.cmd" apply %AUTO% %*
if errorlevel 1 exit /b 1
echo.
echo ----------------------------------------------------------------------
echo The server is up. First boot takes 5 to 10 minutes: packages, mounts, containers.
echo   .\aether wait     waits until the setup is done
echo   .\aether site     opens the site
echo   .\aether down     when you are done: the server bills by the hour
echo ----------------------------------------------------------------------
exit /b 0
