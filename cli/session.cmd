@echo off
rem @group Session
rem @help Start a whole session: up, then wait for the setup, then open the site
rem @args [-y] [-var=enable_private=false] [-var=...]
rem @raw  .\infra\tf apply
rem @raw  ssh deploy@<ip> cloud-init status --wait
rem @raw  start https://<your public hostname>        or the SSH tunnel, see  .\aether manual site
setlocal
call "%AETHER_CLI%\up.cmd" %*
if errorlevel 1 exit /b 1
call "%AETHER_CLI%\wait.cmd"
if errorlevel 1 exit /b 1
call "%AETHER_CLI%\site.cmd"
exit /b %ERRORLEVEL%
