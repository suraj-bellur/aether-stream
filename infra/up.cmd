@echo off
rem Start a session: create the server (and the tunnels that are switched on), then print the outputs.
rem Usage:   .\infra\up
rem          .\infra\up -var="enable_tunnel=false"      (SSH-tunnel-only session)
rem Terraform shows the plan and asks you to type yes.
call "%~dp0tf.cmd" apply %*
if errorlevel 1 exit /b %ERRORLEVEL%
echo.
echo ----------------------------------------------------------------------
echo The server is up, but first boot takes 5 to 10 minutes (packages, mounts, containers).
echo Log in with the ssh_command above and run:  cloud-init status --wait
echo Remember to run  .\infra\down  when you are done: the server bills by the hour.
echo ----------------------------------------------------------------------
