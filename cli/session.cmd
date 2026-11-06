@echo off
rem @group Session
rem @help Start a whole session: up, then wait for the setup, then open the site
rem @args [-y] [-var=name=value]
rem @opt -y                         skip the 'type yes' question
rem @opt -var=enable_private=false  no private site, public site only
rem @opt -var=enable_tunnel=false   no Cloudflare tunnel (open the site with: site local)
rem @opt -var=name=value            change any other setting from infra\server\variables.tf
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
