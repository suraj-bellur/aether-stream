@echo off
rem @group Setup
rem @help Any Terraform command for the Storage Box stack, for example  .\aether tfs output
rem @args terraform arguments
rem @raw  .\infra\tfs ARGS         =  terraform -chdir=infra\storage ARGS, with the secrets loaded
call "%AETHER_INFRA%\tfs.cmd" %*
exit /b %ERRORLEVEL%
