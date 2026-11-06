@echo off
rem @group Storage
rem @help Open or close external access, so your PC can or cannot reach the Storage Box
rem @args <open or close>
rem @opt open                       let your PC reach the Storage Box (for uploads)
rem @opt close                      shut it again
rem @raw  .\infra\tfs apply -var="external_access=true"        open
rem @raw  .\infra\tfs apply                                    close: external_access defaults to false
setlocal
call "%AETHER_LIB%\box.cmd" public
if errorlevel 1 exit /b 1
call "%AETHER_LIB%\access.cmd" %1
exit /b %ERRORLEVEL%
