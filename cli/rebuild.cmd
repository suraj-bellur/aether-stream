@echo off
rem @group Session
rem @help Destroy the server and create a fresh one, for example after changing a switch
rem @args [-y] [-var=enable_private=false] [-var=...]
rem @raw  .\infra\tf destroy
rem @raw  .\infra\tf apply
rem @raw  for a code change only, .\aether update is quicker
setlocal
call "%AETHER_LIB%\confirm.cmd" "Destroy the server and build a new one? Takes 5 to 10 minutes."
if errorlevel 1 exit /b 1
call "%AETHER_INFRA%\tf.cmd" destroy -auto-approve
if errorlevel 1 exit /b 1
call "%AETHER_CLI%\up.cmd" %*
exit /b %ERRORLEVEL%
